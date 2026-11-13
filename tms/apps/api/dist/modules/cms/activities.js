import { activityCreateSchema, activityUpdateSchema } from '@erniza/shared';
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, conflict, notFound } from '../../lib/errors.js';
import { escapeLike, paginationMeta, parsePagination, queryString } from '../../lib/pagination.js';
import { requireAuth } from '../../middleware/auth.js';
import { providedKeys, validate } from '../../middleware/validate.js';
import { ensureUniqueSlug } from '../../services/cms.js';
import { mediaUrl } from '../../services/storage.js';
export const activitiesRouter = Router();
activitiesRouter.use(requireAuth);
const columns = {
    name: 'name',
    category: 'category',
    summary: 'summary',
    description: 'description',
    status: 'status',
    imageId: 'image_id',
};
activitiesRouter.get('/', asyncHandler(async (req, res) => {
    const { page, pageSize, offset, q } = parsePagination(req, 50);
    const status = queryString(req, 'status');
    const params = [];
    const conditions = [];
    if (status) {
        params.push(status);
        conditions.push(`a.status = $${params.length}`);
    }
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(a.name ILIKE $${params.length} OR a.category ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const [count, rows] = await Promise.all([
        db.query(`SELECT count(*)::int AS total FROM activities a ${where}`, params),
        db.query(`SELECT a.*, m.storage_bucket, m.storage_path,
                (SELECT count(*)::int FROM product_activities pa WHERE pa.activity_id = a.id) AS product_count
           FROM activities a LEFT JOIN media m ON m.id = a.image_id
           ${where} ORDER BY a.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]),
    ]);
    res.json({
        data: rows.rows.map(mapActivity),
        meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0),
    });
}));
activitiesRouter.post('/', validate(activityCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    const id = await db.transaction(async (tx) => {
        const slug = await ensureUniqueSlug(tx, 'activities', input.slug, input.name);
        const result = await tx.query(`INSERT INTO activities (name, slug, category, summary, description, status, image_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [
            input.name,
            slug,
            input.category ?? null,
            input.summary ?? null,
            input.description ?? null,
            input.status,
            input.imageId ?? null,
        ]);
        const createdId = result.rows[0].id;
        await logAudit(tx, {
            actor,
            action: 'activity.created',
            entityType: 'activity',
            entityId: createdId,
            changes: { name: input.name, status: input.status },
            ...requestAuditContext(req),
        });
        return createdId;
    });
    res.status(201).json({ data: await loadActivity(id) });
}));
activitiesRouter.get('/:id', asyncHandler(async (req, res) => {
    res.json({ data: await loadActivity(req.params.id) });
}));
activitiesRouter.patch('/:id', validate(activityUpdateSchema), asyncHandler(async (req, res) => {
    const allInput = req.body;
    const keys = new Set(providedKeys(req) ?? Object.keys(allInput));
    const input = Object.fromEntries(Object.entries(allInput).filter(([key]) => keys.has(key)));
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT id, name FROM activities WHERE id = $1', [
            req.params.id,
        ]);
        const current = existing.rows[0];
        if (!current)
            throw notFound('Activity not found');
        const fields = [];
        const values = [];
        for (const [key, column] of Object.entries(columns)) {
            if (key in input) {
                values.push(input[key] ?? null);
                fields.push(`${column} = $${values.length}`);
            }
        }
        if (input.slug !== undefined) {
            const slug = await ensureUniqueSlug(tx, 'activities', input.slug, input.name ?? current.name, req.params.id);
            values.push(slug);
            fields.push(`slug = $${values.length}`);
        }
        if (!fields.length) {
            res.json({ data: await loadActivity(req.params.id) });
            return;
        }
        values.push(req.params.id);
        await tx.query(`UPDATE activities SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
        await logAudit(tx, {
            actor,
            action: 'activity.updated',
            entityType: 'activity',
            entityId: req.params.id,
            changes: input,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadActivity(req.params.id) });
}));
for (const [suffix, action, status] of [
    ['publish', 'activity.published', 'published'],
    ['unpublish', 'activity.unpublished', 'draft'],
    ['archive', 'activity.archived', 'archived'],
]) {
    activitiesRouter.post(`/:id/${suffix}`, asyncHandler(async (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        await db.transaction(async (tx) => {
            const result = await tx.query('SELECT id FROM activities WHERE id = $1', [req.params.id]);
            if (!result.rows[0])
                throw notFound('Activity not found');
            await tx.query('UPDATE activities SET status = $1, updated_at = now() WHERE id = $2', [status, req.params.id]);
            await logAudit(tx, {
                actor,
                action,
                entityType: 'activity',
                entityId: req.params.id,
                changes: { status },
                ...requestAuditContext(req),
            });
        });
        res.json({ data: await loadActivity(req.params.id) });
    }));
}
activitiesRouter.delete('/:id', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const usage = await tx.query('SELECT count(*)::int AS count FROM product_activities WHERE activity_id = $1', [req.params.id]);
        if ((usage.rows[0]?.count ?? 0) > 0) {
            throw conflict('This activity is linked to products. Remove those links or archive it instead.');
        }
        const result = await tx.query('DELETE FROM activities WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows[0])
            throw notFound('Activity not found');
        await logAudit(tx, {
            actor,
            action: 'activity.deleted',
            entityType: 'activity',
            entityId: req.params.id,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: { success: true } });
}));
async function loadActivity(id) {
    const db = getDb();
    const result = await db.query(`SELECT a.*, m.storage_bucket, m.storage_path FROM activities a LEFT JOIN media m ON m.id = a.image_id WHERE a.id = $1`, [id]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Activity not found');
    const products = await db.query(`SELECT p.id, p.name, p.slug FROM product_activities pa JOIN products p ON p.id = pa.product_id WHERE pa.activity_id = $1 ORDER BY p.name`, [id]);
    return { ...mapActivity(row), products: products.rows };
}
function mapActivity(row) {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        category: row.category,
        summary: row.summary,
        description: row.description,
        status: row.status,
        imageId: row.image_id,
        imageUrl: row.storage_bucket ? mediaUrl(row.storage_bucket, row.storage_path) : null,
        productCount: row.product_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
