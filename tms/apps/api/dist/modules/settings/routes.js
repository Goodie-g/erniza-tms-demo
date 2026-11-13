import { settingsUpdateSchema } from '@erniza/shared';
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler } from '../../lib/errors.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { getSettings, saveSettings } from '../../services/settings.js';
export const settingsRouter = Router();
settingsRouter.use(requireAuth);
settingsRouter.get('/', asyncHandler(async (_req, res) => {
    res.json({ data: await getSettings() });
}));
settingsRouter.patch('/', requireRole('owner', 'admin'), validate(settingsUpdateSchema), asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const input = req.body;
    const db = getDb();
    const updated = await db.transaction(async (tx) => {
        const result = await saveSettings(tx, input, actor.id);
        await logAudit(tx, {
            actor,
            action: 'settings.updated',
            entityType: 'settings',
            entityId: null,
            changes: { sections: Object.keys(input) },
            ...requestAuditContext(req),
        });
        return result;
    });
    res.json({ data: updated });
}));
