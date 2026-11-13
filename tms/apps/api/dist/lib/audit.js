/**
 * Append-only audit trail. Every business-critical mutation calls this within
 * the same transaction as the mutation itself, so failures roll back together.
 */
export async function logAudit(tx, input) {
    await tx.query(`INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, changes, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
        input.actor?.id ?? null,
        input.actor?.email ?? null,
        input.action,
        input.entityType,
        input.entityId ?? null,
        input.changes ? JSON.stringify(input.changes) : null,
        input.ip ?? null,
        input.userAgent ?? null,
    ]);
}
export function requestAuditContext(req) {
    return {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
    };
}
