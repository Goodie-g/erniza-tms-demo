import { mediaUpdateSchema } from '@erniza/shared';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../../config.js';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/errors.js';
import { escapeLike, paginationMeta, parsePagination } from '../../lib/pagination.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { mediaUrl, removeStoredImage, storeImage } from '../../services/storage.js';
export const mediaRouter = Router();
mediaRouter.use(requireAuth);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes, files: 1 },
});
mediaRouter.get('/', asyncHandler(async (req, res) => {
    const { page, pageSize, offset, q } = parsePagination(req, 40);
    const params = [];
    const conditions = ['m.archived_at IS NULL'];
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(m.file_name ILIKE $${params.length} OR m.alt_text ILIKE $${params.length})`);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const db = getDb();
    const [count, rows] = await Promise.all([
        db.query(`SELECT count(*)::int AS total FROM media m ${where}`, params),
        db.query(`SELECT m.*,
                (SELECT count(*)::int FROM product_media pm WHERE pm.media_id = m.id)
                + (SELECT count(*)::int FROM products p WHERE p.hero_image_id = m.id)
                + (SELECT count(*)::int FROM destinations d WHERE d.hero_image_id = m.id)
                + (SELECT count(*)::int FROM activities a WHERE a.image_id = m.id) AS usage_count
           FROM media m ${where} ORDER BY m.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]),
    ]);
    res.json({
        data: rows.rows.map(mapMedia),
        meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0),
    });
}));
mediaRouter.post('/', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file)
        throw badRequest('Select an image to upload.');
    const altText = typeof req.body?.altText === 'string' ? req.body.altText.trim().slice(0, 300) : null;
    const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 1000) : null;
    const stored = await storeImage(req.file);
    const actor = req.authUser;
    const db = getDb();
    const id = await db.transaction(async (tx) => {
        const result = await tx.query(`INSERT INTO media (storage_bucket, storage_path, file_name, mime_type, size_bytes, width, height, alt_text, description, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [
            stored.bucket,
            stored.path,
            stored.fileName,
            stored.mimeType,
            stored.sizeBytes,
            stored.width,
            stored.height,
            altText,
            description,
            actor.id,
        ]);
        const createdId = result.rows[0].id;
        await logAudit(tx, {
            actor,
            action: 'media.uploaded',
            entityType: 'media',
            entityId: createdId,
            changes: { fileName: stored.fileName, sizeBytes: stored.sizeBytes },
            ...requestAuditContext(req),
        });
        return createdId;
    });
    const created = await db.query('SELECT * FROM media WHERE id = $1', [id]);
    res.status(201).json({ data: mapMedia(created.rows[0]) });
}));
mediaRouter.patch('/:id', validate(mediaUpdateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    const fields = [];
    const values = [];
    if (input.altText !== undefined) {
        values.push(input.altText ?? null);
        fields.push(`alt_text = $${values.length}`);
    }
    if (input.description !== undefined) {
        values.push(input.description ?? null);
        fields.push(`description = $${values.length}`);
    }
    if (!fields.length) {
        res.json({ data: { success: true } });
        return;
    }
    values.push(req.params.id);
    await db.transaction(async (tx) => {
        const result = await tx.query(`UPDATE media SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING id`, values);
        if (!result.rows[0])
            throw notFound('Media not found');
        await logAudit(tx, {
            actor,
            action: 'media.updated',
            entityType: 'media',
            entityId: req.params.id,
            changes: input,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: { success: true } });
}));
mediaRouter.delete('/:id', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    const record = await db.query('SELECT storage_bucket, storage_path FROM media WHERE id = $1', [req.params.id]);
    const media = record.rows[0];
    if (!media)
        throw notFound('Media not found');
    const usage = await db.query(`SELECT (
        (SELECT count(*)::int FROM product_media WHERE media_id = $1)
        + (SELECT count(*)::int FROM products WHERE hero_image_id = $1)
        + (SELECT count(*)::int FROM destinations WHERE hero_image_id = $1)
        + (SELECT count(*)::int FROM activities WHERE image_id = $1)
      ) AS count`, [req.params.id]);
    if ((usage.rows[0]?.count ?? 0) > 0) {
        throw conflict('This image is in use. Remove it from content before deleting it.');
    }
    await removeStoredImage(media.storage_bucket, media.storage_path);
    await db.transaction(async (tx) => {
        await tx.query('DELETE FROM media WHERE id = $1', [req.params.id]);
        await logAudit(tx, {
            actor,
            action: 'media.deleted',
            entityType: 'media',
            entityId: req.params.id,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: { success: true } });
}));
function mapMedia(row) {
    return {
        id: row.id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes),
        width: row.width,
        height: row.height,
        altText: row.alt_text,
        description: row.description,
        url: mediaUrl(row.storage_bucket, row.storage_path),
        usageCount: row.usage_count,
        createdAt: row.created_at,
    };
}
