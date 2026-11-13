import { destinationCreateSchema, destinationUpdateSchema } from '@erniza/shared';
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, conflict, notFound } from '../../lib/errors.js';
import { escapeLike, paginationMeta, parsePagination, queryString } from '../../lib/pagination.js';
import { requireAuth } from '../../middleware/auth.js';
import { providedKeys, validate } from '../../middleware/validate.js';
import { ensureUniqueSlug } from '../../services/cms.js';
import { mediaUrl } from '../../services/storage.js';
export const destinationsRouter = Router();
destinationsRouter.use(requireAuth);
const columns = {
    name: 'name',
    region: 'region',
    country: 'country',
    summary: 'summary',
    description: 'description',
    latitude: 'latitude',
    longitude: 'longitude',
    bestTime: 'best_time',
    seoTitle: 'seo_title',
    seoDescription: 'seo_description',
    status: 'status',
    featured: 'featured',
    heroImageId: 'hero_image_id',
};
destinationsRouter.get('/', asyncHandler(async (req, res) => {
    const { page, pageSize, offset, q } = parsePagination(req, 50);
    const status = queryString(req, 'status');
    const params = [];
    const conditions = [];
    if (status) {
        params.push(status);
        conditions.push(`d.status = $${params.length}`);
    }
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(d.name ILIKE $${params.length} OR d.region ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const [count, rows] = await Promise.all([
        db.query(`SELECT count(*)::int AS total FROM destinations d ${where}`, params),
        db.query(`SELECT d.*, m.storage_bucket, m.storage_path,
                (SELECT count(*)::int FROM product_destinations pd WHERE pd.destination_id = d.id) AS product_count
           FROM destinations d LEFT JOIN media m ON m.id = d.hero_image_id
           ${where} ORDER BY d.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]),
    ]);
    res.json({
        data: rows.rows.map(mapDestination),
        meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0),
    });
}));
destinationsRouter.post('/', validate(destinationCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    const id = await db.transaction(async (tx) => {
        const slug = await ensureUniqueSlug(tx, 'destinations', input.slug, input.name);
        const fields = [...Object.keys(columns), 'slug', 'published_at'];
        const values = Object.entries(columns).map(([key, column]) => {
            void column;
            if (key === 'heroImageId')
                return input.heroImageId ?? null;
            return input[key] ?? (key === 'country' ? 'Tanzania' : null);
        });
        values.push(slug, input.status === 'published' ? new Date() : null);
        const result = await tx.query(`INSERT INTO destinations (${fields.join(', ')}) VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING id`, values);
        const createdId = result.rows[0].id;
        await logAudit(tx, {
            actor,
            action: 'destination.created',
            entityType: 'destination',
            entityId: createdId,
            changes: { name: input.name, status: input.status },
            ...requestAuditContext(req),
        });
        return createdId;
    });
    res.status(201).json({ data: await loadDestination(id) });
}));
destinationsRouter.get('/:id', asyncHandler(async (req, res) => {
    res.json({ data: await loadDestination(req.params.id) });
}));
destinationsRouter.patch('/:id', validate(destinationUpdateSchema), asyncHandler(async (req, res) => {
    const allInput = req.body;
    const keys = new Set(providedKeys(req) ?? Object.keys(allInput));
    const input = Object.fromEntries(Object.entries(allInput).filter(([key]) => keys.has(key)));
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT id, name, published_at FROM destinations WHERE id = $1', [req.params.id]);
        const current = existing.rows[0];
        if (!current)
            throw notFound('Destination not found');
        const setFields = [];
        const values = [];
        for (const [key, column] of Object.entries(columns)) {
            if (key in input) {
                values.push(input[key] ?? null);
                setFields.push(`${column} = $${values.length}`);
            }
        }
        if (input.slug !== undefined) {
            const slug = await ensureUniqueSlug(tx, 'destinations', input.slug, input.name ?? current.name, req.params.id);
            values.push(slug);
            setFields.push(`slug = $${values.length}`);
        }
        if (input.status === 'published' && !current.published_at) {
            values.push(new Date());
            setFields.push(`published_at = $${values.length}`);
        }
        if (!setFields.length) {
            res.json({ data: await loadDestination(req.params.id) });
            return;
        }
        values.push(req.params.id);
        const result = await tx.query(`UPDATE destinations SET ${setFields.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING id`, values);
        if (!result.rows[0])
            throw notFound('Destination not found');
        const action = input.status === 'published' ? 'destination.published' : input.status === 'archived' ? 'destination.archived' : 'destination.updated';
        await logAudit(tx, {
            actor,
            action,
            entityType: 'destination',
            entityId: req.params.id,
            changes: input,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadDestination(req.params.id) });
}));
for (const [suffix, action, status] of [
    ['publish', 'destination.published', 'published'],
    ['unpublish', 'destination.unpublished', 'draft'],
    ['archive', 'destination.archived', 'archived'],
]) {
    destinationsRouter.post(`/:id/${suffix}`, asyncHandler(async (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        await db.transaction(async (tx) => {
            const result = await tx.query('SELECT id, published_at FROM destinations WHERE id = $1', [req.params.id]);
            const destination = result.rows[0];
            if (!destination)
                throw notFound('Destination not found');
            await tx.query(`UPDATE destinations SET status = $1, published_at = $2, updated_at = now() WHERE id = $3`, [status, status === 'published' ? destination.published_at ?? new Date() : destination.published_at, req.params.id]);
            await logAudit(tx, {
                actor,
                action,
                entityType: 'destination',
                entityId: req.params.id,
                changes: { status },
                ...requestAuditContext(req),
            });
        });
        res.json({ data: await loadDestination(req.params.id) });
    }));
}
destinationsRouter.delete('/:id', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const usage = await tx.query('SELECT count(*)::int AS count FROM product_destinations WHERE destination_id = $1', [req.params.id]);
        if ((usage.rows[0]?.count ?? 0) > 0) {
            throw conflict('This destination is linked to products. Remove those links or archive it instead.');
        }
        const result = await tx.query('DELETE FROM destinations WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows[0])
            throw notFound('Destination not found');
        await logAudit(tx, {
            actor,
            action: 'destination.deleted',
            entityType: 'destination',
            entityId: req.params.id,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: { success: true } });
}));
async function loadDestination(id) {
    const db = getDb();
    const result = await db.query(`SELECT d.*, m.storage_bucket, m.storage_path FROM destinations d LEFT JOIN media m ON m.id = d.hero_image_id WHERE d.id = $1`, [id]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Destination not found');
    const products = await db.query(`SELECT p.id, p.name, p.slug, p.status, p.duration_days
       FROM product_destinations pd JOIN products p ON p.id = pd.product_id
      WHERE pd.destination_id = $1 ORDER BY p.name`, [id]);
    return { ...mapDestination(row), products: products.rows };
}
function mapDestination(row) {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        region: row.region,
        country: row.country,
        summary: row.summary,
        description: row.description,
        latitude: row.latitude,
        longitude: row.longitude,
        bestTime: row.best_time,
        seoTitle: row.seo_title,
        seoDescription: row.seo_description,
        status: row.status,
        featured: row.featured,
        heroImageId: row.hero_image_id,
        heroImageUrl: row.storage_bucket ? mediaUrl(row.storage_bucket, row.storage_path) : null,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        productCount: row.product_count,
    };
}
