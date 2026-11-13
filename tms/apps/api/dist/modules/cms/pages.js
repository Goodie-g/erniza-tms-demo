import { pageUpdateSchema } from '@erniza/shared';
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, notFound } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
export const pagesRouter = Router();
pagesRouter.use(requireAuth);
pagesRouter.get('/', asyncHandler(async (_req, res) => {
    const db = getDb();
    const result = await db.query('SELECT * FROM website_pages ORDER BY slug');
    res.json({
        data: result.rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            content: row.content,
            status: row.status,
            seoTitle: row.seo_title,
            seoDescription: row.seo_description,
            publishedAt: row.published_at,
            updatedAt: row.updated_at,
        })),
    });
}));
pagesRouter.get('/:id', asyncHandler(async (req, res) => {
    const db = getDb();
    const result = await db.query('SELECT * FROM website_pages WHERE id = $1', [req.params.id]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Page not found');
    res.json({
        data: {
            id: row.id,
            slug: row.slug,
            title: row.title,
            content: row.content,
            status: row.status,
            seoTitle: row.seo_title,
            seoDescription: row.seo_description,
            publishedAt: row.published_at,
            updatedAt: row.updated_at,
        },
    });
}));
pagesRouter.patch('/:id', validate(pageUpdateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT id, status, published_at FROM website_pages WHERE id = $1', [req.params.id]);
        const current = existing.rows[0];
        if (!current)
            throw notFound('Page not found');
        const fields = [];
        const values = [];
        if (input.title !== undefined) {
            values.push(input.title);
            fields.push(`title = $${values.length}`);
        }
        if (input.content !== undefined) {
            values.push(JSON.stringify(input.content));
            fields.push(`content = $${values.length}`);
        }
        if (input.status !== undefined) {
            values.push(input.status);
            fields.push(`status = $${values.length}`);
            if (input.status === 'published') {
                values.push(current.published_at ?? new Date());
                fields.push(`published_at = $${values.length}`);
            }
        }
        if (input.seoTitle !== undefined) {
            values.push(input.seoTitle ?? null);
            fields.push(`seo_title = $${values.length}`);
        }
        if (input.seoDescription !== undefined) {
            values.push(input.seoDescription ?? null);
            fields.push(`seo_description = $${values.length}`);
        }
        if (!fields.length)
            return;
        values.push(actor.id, req.params.id);
        await tx.query(`UPDATE website_pages SET ${fields.join(', ')}, updated_by = $${values.length - 1}, updated_at = now() WHERE id = $${values.length}`, values);
        await logAudit(tx, {
            actor,
            action: input.status === 'published' ? 'page.published' : 'page.updated',
            entityType: 'website_page',
            entityId: req.params.id,
            changes: { fields: Object.keys(input) },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: { success: true } });
}));
for (const [suffix, action, status] of [
    ['publish', 'page.published', 'published'],
    ['unpublish', 'page.unpublished', 'draft'],
    ['archive', 'page.archived', 'archived'],
]) {
    pagesRouter.post(`/:id/${suffix}`, asyncHandler(async (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        await db.transaction(async (tx) => {
            const existing = await tx.query('SELECT id, published_at FROM website_pages WHERE id = $1', [req.params.id]);
            const page = existing.rows[0];
            if (!page)
                throw notFound('Page not found');
            await tx.query('UPDATE website_pages SET status = $1, published_at = $2, updated_by = $3, updated_at = now() WHERE id = $4', [status, status === 'published' ? page.published_at ?? new Date() : page.published_at, actor.id, req.params.id]);
            await logAudit(tx, {
                actor,
                action,
                entityType: 'website_page',
                entityId: req.params.id,
                changes: { status },
                ...requestAuditContext(req),
            });
        });
        res.json({ data: { success: true } });
    }));
}
