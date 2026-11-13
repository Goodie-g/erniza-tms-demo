import { productCategorySchema } from '@erniza/shared';
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, conflict, notFound } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ensureUniqueSlug } from '../../services/cms.js';
export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);
categoriesRouter.get('/', asyncHandler(async (_req, res) => {
    const db = getDb();
    const result = await db.query(`SELECT c.*, (SELECT count(*)::int FROM products p WHERE p.category_id = c.id) AS product_count
         FROM product_categories c ORDER BY c.sort_order, c.name`);
    res.json({
        data: result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: row.description,
            sortOrder: row.sort_order,
            productCount: row.product_count,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        })),
    });
}));
categoriesRouter.post('/', validate(productCategorySchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    const id = await db.transaction(async (tx) => {
        const slug = await ensureUniqueSlug(tx, 'product_categories', input.slug, input.name);
        const result = await tx.query('INSERT INTO product_categories (name, slug, description, sort_order) VALUES ($1,$2,$3,$4) RETURNING id', [input.name, slug, input.description ?? null, input.sortOrder]);
        const createdId = result.rows[0].id;
        await logAudit(tx, {
            actor,
            action: 'product_category.created',
            entityType: 'product_category',
            entityId: createdId,
            changes: { name: input.name },
            ...requestAuditContext(req),
        });
        return createdId;
    });
    res.status(201).json({ data: { id } });
}));
categoriesRouter.patch('/:id', validate(productCategorySchema.partial()), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const current = await tx.query('SELECT id, name FROM product_categories WHERE id = $1', [req.params.id]);
        if (!current.rows[0])
            throw notFound('Category not found');
        const fields = [];
        const values = [];
        if (input.name !== undefined) {
            values.push(input.name);
            fields.push(`name = $${values.length}`);
        }
        if (input.slug !== undefined) {
            const slug = await ensureUniqueSlug(tx, 'product_categories', input.slug, input.name ?? current.rows[0].name, req.params.id);
            values.push(slug);
            fields.push(`slug = $${values.length}`);
        }
        if (input.description !== undefined) {
            values.push(input.description ?? null);
            fields.push(`description = $${values.length}`);
        }
        if (input.sortOrder !== undefined) {
            values.push(input.sortOrder);
            fields.push(`sort_order = $${values.length}`);
        }
        if (!fields.length)
            return;
        values.push(req.params.id);
        await tx.query(`UPDATE product_categories SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
        await logAudit(tx, {
            actor,
            action: 'product_category.updated',
            entityType: 'product_category',
            entityId: req.params.id,
            changes: input,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: { success: true } });
}));
categoriesRouter.delete('/:id', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const usage = await tx.query('SELECT count(*)::int AS count FROM products WHERE category_id = $1', [
            req.params.id,
        ]);
        if ((usage.rows[0]?.count ?? 0) > 0) {
            throw conflict('Products use this category. Reassign them before deleting it.');
        }
        const result = await tx.query('DELETE FROM product_categories WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows[0])
            throw notFound('Category not found');
        await logAudit(tx, {
            actor,
            action: 'product_category.deleted',
            entityType: 'product_category',
            entityId: req.params.id,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: { success: true } });
}));
