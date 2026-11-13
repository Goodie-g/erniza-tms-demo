import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { badRequest } from '../lib/errors.js';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
let supabase = null;
function supabaseClient() {
    if (!config.usingSupabaseStorage)
        return null;
    if (!supabase) {
        supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return supabase;
}
export function mediaUrl(bucket, storagePath) {
    if (config.usingSupabaseStorage) {
        return `${config.supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
    }
    return `${config.apiPublicUrl}/uploads/${storagePath.replace(/^\/+/, '')}`;
}
export async function storeImage(file) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
        throw badRequest('Only JPEG, PNG, WebP and AVIF images are allowed.');
    }
    if (file.size > config.maxUploadBytes) {
        throw badRequest(`Images must be smaller than ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`);
    }
    let pipeline = sharp(file.buffer, { failOn: 'error' }).rotate();
    const metadata = await pipeline.metadata();
    if (!metadata.width || !metadata.height)
        throw badRequest('The uploaded file is not a valid image.');
    if (metadata.width > 2400)
        pipeline = pipeline.resize({ width: 2400, withoutEnlargement: true });
    const output = await pipeline.webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true });
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 60) || 'image';
    const now = new Date();
    const storagePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}-${base}.webp`;
    const bucket = config.supabaseBucket;
    const client = supabaseClient();
    if (client) {
        const { error } = await client.storage.from(bucket).upload(storagePath, output.data, {
            contentType: 'image/webp',
            cacheControl: '31536000',
            upsert: false,
        });
        if (error)
            throw new Error(`Storage upload failed: ${error.message}`);
    }
    else {
        const target = path.join(config.uploadDir, storagePath);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, output.data);
    }
    return {
        bucket,
        path: storagePath,
        fileName: file.originalname,
        mimeType: 'image/webp',
        sizeBytes: output.info.size,
        width: output.info.width,
        height: output.info.height,
    };
}
export async function removeStoredImage(bucket, storagePath) {
    const client = supabaseClient();
    if (client) {
        const { error } = await client.storage.from(bucket).remove([storagePath]);
        if (error)
            throw new Error(`Storage delete failed: ${error.message}`);
        return;
    }
    const target = path.join(config.uploadDir, storagePath);
    await fs.rm(target, { force: true });
}
