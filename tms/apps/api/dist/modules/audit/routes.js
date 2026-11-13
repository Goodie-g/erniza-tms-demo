import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { asyncHandler, notFound } from '../../lib/errors.js';
import { escapeLike, paginationMeta, parsePagination, queryDate, queryString } from '../../lib/pagination.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole('owner', 'admin'));
auditRouter.get('/', asyncHandler(async (req, res) => {
    const { page, pageSize, offset, q } = parsePagination(req, 30);
    const entityType = queryString(req, 'entityType');
    const entityId = queryString(req, 'entityId');
    const actorId = queryString(req, 'actorId');
    const action = queryString(req, 'action');
    const from = queryDate(req, 'from');
    const to = queryDate(req, 'to');
    const params = [];
    const conditions = [];
    if (entityType) {
        params.push(entityType);
        conditions.push(`entity_type = $${params.length}`);
    }
    if (entityId) {
        params.push(entityId);
        conditions.push(`entity_id = $${params.length}`);
    }
    if (actorId) {
        params.push(actorId);
        conditions.push(`actor_id = $${params.length}`);
    }
    if (action) {
        params.push(`%${escapeLike(action)}%`);
        conditions.push(`action ILIKE $${params.length}`);
    }
    if (from) {
        params.push(from);
        conditions.push(`created_at >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        conditions.push(`created_at < ($${params.length}::date + interval '1 day')`);
    }
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(actor_email ILIKE $${params.length} OR action ILIKE $${params.length} OR entity_type ILIKE $${params.length} OR entity_id ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const [count, rows, actions, entityTypes] = await Promise.all([
        db.query(`SELECT count(*)::int AS total FROM audit_logs ${where}`, params),
        db.query(`SELECT * FROM audit_logs ${where}
          ORDER BY created_at DESC, id DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]),
        db.query(`SELECT action, count(*)::int AS count FROM audit_logs GROUP BY action ORDER BY count DESC LIMIT 50`),
        db.query(`SELECT entity_type, count(*)::int AS count FROM audit_logs GROUP BY entity_type ORDER BY count DESC LIMIT 50`),
    ]);
    res.json({
        data: rows.rows.map((row) => ({
            id: String(row.id),
            actorId: row.actor_id,
            actorEmail: row.actor_email,
            action: row.action,
            entityType: row.entity_type,
            entityId: row.entity_id,
            changes: row.changes,
            ip: row.ip,
            userAgent: row.user_agent,
            createdAt: row.created_at,
        })),
        meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0),
        filters: { actions: actions.rows, entityTypes: entityTypes.rows },
    });
}));
auditRouter.get('/:id', asyncHandler(async (req, res) => {
    const result = await getDb().query('SELECT * FROM audit_logs WHERE id = $1', [
        req.params.id,
    ]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Audit entry not found');
    res.json({
        data: {
            id: String(row.id),
            actorId: row.actor_id,
            actorEmail: row.actor_email,
            action: row.action,
            entityType: row.entity_type,
            entityId: row.entity_id,
            changes: row.changes,
            ip: row.ip,
            userAgent: row.user_agent,
            createdAt: row.created_at,
        },
    });
}));
