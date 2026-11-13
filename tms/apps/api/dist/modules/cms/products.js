import { productCreateSchema, productUpdateSchema } from '@erniza/shared';
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, conflict, notFound, unprocessable } from '../../lib/errors.js';
import { escapeLike, paginationMeta, parsePagination, queryString } from '../../lib/pagination.js';
import { requireAuth } from '../../middleware/auth.js';
import { providedKeys, validate } from '../../middleware/validate.js';
import { ensureUniqueSlug, loadProduct, productColumns, syncProductRelations, } from '../../services/cms.js';
import { mediaUrl } from '../../services/storage.js';
export const productsRouter = Router();
productsRouter.use(requireAuth);
productsRouter.get('/', asyncHandler(async (req, res) => {
    const { page, pageSize, offset, q } = parsePagination(req);
    const status = queryString(req, 'status');
    const categoryId = queryString(req, 'categoryId');
    const featured = queryString(req, 'featured');
    const params = [];
    const conditions = [];
    if (status) {
        params.push(status);
        conditions.push(`p.status = $${params.length}`);
    }
    if (categoryId) {
        params.push(categoryId);
        conditions.push(`p.category_id = $${params.length}`);
    }
    if (featured === 'true' || featured === 'false') {
        params.push(featured === 'true');
        conditions.push(`p.featured = $${params.length}`);
    }
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(p.name ILIKE $${params.length} OR p.summary ILIKE $${params.length} OR p.slug ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const [count, rows] = await Promise.all([
        db.query(`SELECT count(*)::int AS total FROM products p ${where}`, params),
        db.query(`SELECT p.*, c.name AS category_name,
                hm.storage_bucket AS hero_bucket, hm.storage_path AS hero_path,
                (SELECT count(*)::int FROM product_destinations pd WHERE pd.product_id = p.id) AS destination_count,
                (SELECT count(*)::int FROM itineraries i JOIN itinerary_days d ON d.itinerary_id = i.id WHERE i.product_id = p.id) AS day_count
           FROM products p
           LEFT JOIN product_categories c ON c.id = p.category_id
           LEFT JOIN media hm ON hm.id = p.hero_image_id
           ${where}
          ORDER BY p.updated_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]),
    ]);
    res.json({
        data: rows.rows.map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            categoryId: row.category_id,
            categoryName: row.category_name,
            summary: row.summary,
            durationDays: row.duration_days,
            durationNights: row.duration_nights,
            difficulty: row.difficulty,
            status: row.status,
            featured: row.featured,
            heroImageId: row.hero_image_id,
            heroImageUrl: row.hero_bucket ? mediaUrl(row.hero_bucket, row.hero_path) : null,
            destinationCount: row.destination_count,
            dayCount: row.day_count,
            publishedAt: row.published_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        })),
        meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0),
    });
}));
productsRouter.post('/', validate(productCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    validateDays(input.itineraryDays);
    const actor = req.authUser;
    const db = getDb();
    const productId = await db.transaction(async (tx) => {
        const slug = await ensureUniqueSlug(tx, 'products', input.slug, input.name);
        const { fields, values } = productColumns(input, true);
        values.push(slug);
        fields.push('slug');
        values.push(actor.id, actor.id);
        fields.push('created_by', 'updated_by');
        if (input.status === 'published') {
            values.push(new Date());
            fields.push('published_at');
        }
        const placeholders = values.map((_, index) => `$${index + 1}`);
        const result = await tx.query(`INSERT INTO products (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`, values);
        const id = result.rows[0].id;
        await syncProductRelations(tx, id, { ...input, title: input.name });
        await logAudit(tx, {
            actor,
            action: 'product.created',
            entityType: 'product',
            entityId: id,
            changes: { name: input.name, slug, status: input.status },
            ...requestAuditContext(req),
        });
        return id;
    });
    res.status(201).json({ data: await loadProduct(productId) });
}));
productsRouter.get('/:id', asyncHandler(async (req, res) => {
    res.json({ data: await loadProduct(req.params.id) });
}));
productsRouter.patch('/:id', validate(productUpdateSchema), asyncHandler(async (req, res) => {
    const allInput = req.body;
    const keys = new Set(providedKeys(req) ?? Object.keys(allInput));
    const input = Object.fromEntries(Object.entries(allInput).filter(([key]) => keys.has(key)));
    if (input.itineraryDays)
        validateDays(input.itineraryDays);
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT id, status, published_at, name FROM products WHERE id = $1', [req.params.id]);
        const current = existing.rows[0];
        if (!current)
            throw notFound('Product not found');
        const { fields, values } = productColumns(input, false);
        if (input.slug !== undefined) {
            const slug = await ensureUniqueSlug(tx, 'products', input.slug, input.name ?? current.name, req.params.id);
            values.push(slug);
            fields.push('slug');
        }
        if (input.status === 'published' && !current.published_at) {
            values.push(new Date());
            fields.push('published_at');
        }
        if (input.status === 'archived') {
            values.push(new Date());
            fields.push('archived_at');
        }
        if (input.status === 'draft' || input.status === 'published') {
            values.push(null);
            fields.push('archived_at');
        }
        values.push(actor.id, req.params.id);
        fields.push('updated_by', `updated_at`);
        const placeholders = fields.map((field, index) => (field === 'updated_at' ? 'now()' : `$${index + 1}`));
        // updated_at has no value; rebuild safely.
        const setFields = [];
        let valueIndex = 0;
        for (const field of fields) {
            if (field === 'updated_at') {
                setFields.push('updated_at = now()');
            }
            else {
                valueIndex += 1;
                setFields.push(`${field} = $${valueIndex}`);
            }
        }
        const usedValues = values.slice(0, valueIndex);
        usedValues.push(req.params.id);
        const idPlaceholder = `$${valueIndex + 1}`;
        const result = await tx.query(`UPDATE products SET ${setFields.join(', ')} WHERE id = ${idPlaceholder} RETURNING id`, usedValues);
        if (!result.rows[0])
            throw notFound('Product not found');
        await syncProductRelations(tx, req.params.id, { ...input, title: input.name ?? current.name });
        const action = input.status && input.status !== current.status
            ? input.status === 'published'
                ? 'product.published'
                : input.status === 'archived'
                    ? 'product.archived'
                    : 'product.unpublished'
            : 'product.updated';
        await logAudit(tx, {
            actor,
            action,
            entityType: 'product',
            entityId: req.params.id,
            changes: input,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadProduct(req.params.id) });
}));
for (const [suffix, action, status] of [
    ['publish', 'product.published', 'published'],
    ['unpublish', 'product.unpublished', 'draft'],
    ['archive', 'product.archived', 'archived'],
]) {
    productsRouter.post(`/:id/${suffix}`, asyncHandler(async (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        await db.transaction(async (tx) => {
            const result = await tx.query('SELECT id, published_at FROM products WHERE id = $1', [req.params.id]);
            const product = result.rows[0];
            if (!product)
                throw notFound('Product not found');
            await tx.query(`UPDATE products SET status = $1, published_at = $2, archived_at = $3, updated_by = $4, updated_at = now()
           WHERE id = $5`, [
                status,
                status === 'published' ? product.published_at ?? new Date() : product.published_at,
                status === 'archived' ? new Date() : null,
                actor.id,
                req.params.id,
            ]);
            await logAudit(tx, {
                actor,
                action,
                entityType: 'product',
                entityId: req.params.id,
                changes: { status },
                ...requestAuditContext(req),
            });
        });
        res.json({ data: await loadProduct(req.params.id) });
    }));
}
productsRouter.delete('/:id', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const usage = await tx.query(`SELECT
          (SELECT count(*)::int FROM quotations WHERE primary_product_id = $1) AS quotations,
          (SELECT count(*)::int FROM bookings WHERE product_id = $1) AS bookings,
          (SELECT count(*)::int FROM enquiries WHERE product_id = $1) AS enquiries`, [req.params.id]);
        const row = usage.rows[0];
        if (!row)
            throw notFound('Product not found');
        if (row.quotations > 0 || row.bookings > 0 || row.enquiries > 0) {
            throw conflict('This product is referenced by enquiries, quotations or bookings. Archive it instead.');
        }
        const result = await tx.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows[0])
            throw notFound('Product not found');
        await logAudit(tx, {
            actor,
            action: 'product.deleted',
            entityType: 'product',
            entityId: req.params.id,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: { success: true } });
}));
function validateDays(days) {
    if (!days)
        return;
    const numbers = new Set();
    for (const day of days) {
        if (numbers.has(day.dayNumber))
            throw unprocessable(`Itinerary day ${day.dayNumber} is duplicated.`);
        numbers.add(day.dayNumber);
    }
}
