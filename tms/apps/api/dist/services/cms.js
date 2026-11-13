import { getDb } from '../db/client.js';
import { conflict, notFound } from '../lib/errors.js';
import { slugify } from '../lib/reference.js';
import { mediaUrl } from './storage.js';
const CONTENT_TABLES = new Set(['products', 'destinations', 'activities']);
export async function ensureUniqueSlug(tx, table, desired, name, id) {
    if (!CONTENT_TABLES.has(table) && table !== 'product_categories')
        throw new Error('Invalid table');
    const base = desired?.trim() || slugify(name);
    if (!base)
        throw conflict('A valid slug could not be generated');
    let candidate = base;
    let suffix = 1;
    // Explicit user-provided slugs must be unique; generated slugs get a suffix.
    while (true) {
        const params = [candidate];
        let sql = `SELECT id FROM ${table} WHERE slug = $1`;
        if (id) {
            params.push(id);
            sql += ` AND id <> $2`;
        }
        const existing = await tx.query(sql, params);
        if (!existing.rows[0])
            return candidate;
        if (desired)
            throw conflict(`The slug "${candidate}" is already in use.`);
        suffix += 1;
        candidate = `${base}-${suffix}`;
        if (suffix > 100)
            throw conflict('Could not generate a unique slug');
    }
}
export function mediaAsset(row) {
    if (!row.media_id && !row.id)
        return null;
    const id = row.media_id ?? row.id;
    return {
        id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes),
        width: row.width,
        height: row.height,
        altText: row.alt_text,
        description: row.description,
        url: mediaUrl(row.storage_bucket, row.storage_path),
        createdAt: row.created_at,
    };
}
export async function loadProduct(id, publishedOnly = false) {
    const db = getDb();
    const result = await db.query(`SELECT p.*, c.name AS category_name,
            hm.id AS hero_media_id, hm.storage_bucket AS hero_bucket, hm.storage_path AS hero_path,
            hm.file_name AS hero_file_name, hm.mime_type AS hero_mime, hm.size_bytes AS hero_size,
            hm.width AS hero_width, hm.height AS hero_height, hm.alt_text AS hero_alt,
            hm.description AS hero_description, hm.created_at AS hero_created
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       LEFT JOIN media hm ON hm.id = p.hero_image_id
      WHERE p.id = $1 ${publishedOnly ? "AND p.status = 'published'" : ''}`, [id]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Product not found');
    const [destinations, activities, media, itinerary] = await Promise.all([
        db.query(`SELECT d.id, d.name, d.slug, d.region, d.status
         FROM product_destinations pd JOIN destinations d ON d.id = pd.destination_id
        WHERE pd.product_id = $1 ORDER BY pd.sort_order, d.name`, [id]),
        db.query(`SELECT a.id, a.name, a.slug, a.category
         FROM product_activities pa JOIN activities a ON a.id = pa.activity_id
        WHERE pa.product_id = $1 ORDER BY a.name`, [id]),
        db.query(`SELECT m.*, pm.sort_order
         FROM product_media pm JOIN media m ON m.id = pm.media_id
        WHERE pm.product_id = $1 ORDER BY pm.sort_order, m.created_at`, [id]),
        db.query(`SELECT d.* FROM itinerary_days d
         JOIN itineraries i ON i.id = d.itinerary_id
        WHERE i.product_id = $1 ORDER BY d.day_number`, [id]),
    ]);
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        categoryId: row.category_id,
        categoryName: row.category_name,
        summary: row.summary,
        description: row.description,
        highlights: row.highlights ?? [],
        inclusions: row.inclusions ?? [],
        exclusions: row.exclusions ?? [],
        durationDays: row.duration_days,
        durationNights: row.duration_nights,
        difficulty: row.difficulty,
        minTravellers: row.min_travellers,
        maxTravellers: row.max_travellers,
        accommodationInfo: row.accommodation_info,
        seoTitle: row.seo_title,
        seoDescription: row.seo_description,
        status: row.status,
        featured: row.featured,
        heroImageId: row.hero_image_id,
        heroImageUrl: row.hero_media_id ? mediaUrl(row.hero_bucket, row.hero_path) : null,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        destinations: destinations.rows,
        activities: activities.rows,
        media: media.rows.map((item) => ({
            id: item.id,
            fileName: item.file_name,
            mimeType: item.mime_type,
            sizeBytes: Number(item.size_bytes),
            width: item.width,
            height: item.height,
            altText: item.alt_text,
            description: item.description,
            url: mediaUrl(item.storage_bucket, item.storage_path),
            createdAt: item.created_at,
        })),
        itineraryDays: itinerary.rows.map((day) => ({
            id: day.id,
            dayNumber: day.day_number,
            title: day.title,
            description: day.description,
            accommodation: day.accommodation,
            meals: day.meals,
        })),
    };
}
export async function syncProductRelations(tx, productId, input) {
    if (input.destinationIds !== undefined) {
        await tx.query('DELETE FROM product_destinations WHERE product_id = $1', [productId]);
        for (let index = 0; index < input.destinationIds.length; index += 1) {
            await tx.query('INSERT INTO product_destinations (product_id, destination_id, sort_order) VALUES ($1,$2,$3)', [
                productId,
                input.destinationIds[index],
                index,
            ]);
        }
    }
    if (input.activityIds !== undefined) {
        await tx.query('DELETE FROM product_activities WHERE product_id = $1', [productId]);
        for (const activityId of input.activityIds) {
            await tx.query('INSERT INTO product_activities (product_id, activity_id) VALUES ($1,$2)', [
                productId,
                activityId,
            ]);
        }
    }
    if (input.mediaIds !== undefined) {
        await tx.query('DELETE FROM product_media WHERE product_id = $1', [productId]);
        for (let index = 0; index < input.mediaIds.length; index += 1) {
            await tx.query('INSERT INTO product_media (product_id, media_id, sort_order) VALUES ($1,$2,$3)', [
                productId,
                input.mediaIds[index],
                index,
            ]);
        }
    }
    if (input.itineraryDays !== undefined) {
        const existing = await tx.query('SELECT id FROM itineraries WHERE product_id = $1', [productId]);
        let itineraryId = existing.rows[0]?.id;
        if (!itineraryId) {
            const inserted = await tx.query('INSERT INTO itineraries (product_id, title) VALUES ($1, $2) RETURNING id', [productId, input.title ?? 'Itinerary']);
            itineraryId = inserted.rows[0].id;
        }
        await tx.query('DELETE FROM itinerary_days WHERE itinerary_id = $1', [itineraryId]);
        for (const day of input.itineraryDays) {
            await tx.query(`INSERT INTO itinerary_days (itinerary_id, day_number, title, description, accommodation, meals)
         VALUES ($1,$2,$3,$4,$5,$6)`, [itineraryId, day.dayNumber, day.title, day.description ?? null, day.accommodation ?? null, day.meals ?? null]);
        }
    }
}
export function productColumns(input, isCreate) {
    const map = {
        categoryId: 'category_id',
        name: 'name',
        summary: 'summary',
        description: 'description',
        durationDays: 'duration_days',
        durationNights: 'duration_nights',
        difficulty: 'difficulty',
        minTravellers: 'min_travellers',
        maxTravellers: 'max_travellers',
        accommodationInfo: 'accommodation_info',
        seoTitle: 'seo_title',
        seoDescription: 'seo_description',
        status: 'status',
        featured: 'featured',
        heroImageId: 'hero_image_id',
    };
    const fields = [];
    const values = [];
    for (const [key, column] of Object.entries(map)) {
        if (key in input && (isCreate || input[key] !== undefined)) {
            values.push(input[key] ?? null);
            fields.push(column);
        }
    }
    for (const key of ['highlights', 'inclusions', 'exclusions']) {
        if (key in input && input[key] !== undefined) {
            values.push(JSON.stringify(input[key]));
            fields.push(key);
        }
    }
    return { fields, values };
}
