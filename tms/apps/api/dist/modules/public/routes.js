import { publicEnquirySchema } from '@erniza/shared';
import { Router } from 'express';
import { config } from '../../config.js';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js';
import { escapeLike } from '../../lib/pagination.js';
import { nextReference } from '../../lib/reference.js';
import { validate } from '../../middleware/validate.js';
import { sendEmail } from '../../services/email.js';
import { getSettings } from '../../services/settings.js';
import { mediaUrl } from '../../services/storage.js';
export const publicRouter = Router();
publicRouter.get('/products', asyncHandler(async (req, res) => {
    const db = getDb();
    const limit = Math.min(60, Math.max(1, Number(req.query.limit ?? 24) || 24));
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    const params = [];
    const conditions = ["p.status = 'published'"];
    if (req.query.featured === 'true')
        conditions.push('p.featured = true');
    if (typeof req.query.category === 'string' && req.query.category) {
        params.push(req.query.category);
        conditions.push(`c.slug = $${params.length}`);
    }
    if (typeof req.query.destination === 'string' && req.query.destination) {
        params.push(req.query.destination);
        conditions.push(`EXISTS (SELECT 1 FROM product_destinations pd JOIN destinations d ON d.id = pd.destination_id WHERE pd.product_id = p.id AND d.slug = $${params.length} AND d.status = 'published')`);
    }
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
        params.push(`%${escapeLike(req.query.q.trim().slice(0, 100))}%`);
        conditions.push(`(p.name ILIKE $${params.length} OR p.summary ILIKE $${params.length})`);
    }
    params.push(limit, offset);
    const rows = await db.query(`SELECT p.id, p.name, p.slug, p.summary, p.highlights, p.duration_days, p.duration_nights,
              p.difficulty, p.min_travellers, p.max_travellers, p.featured, p.seo_title, p.seo_description,
              p.updated_at, c.name AS category_name, c.slug AS category_slug,
              hm.storage_bucket AS hero_bucket, hm.storage_path AS hero_path,
              COALESCE((SELECT json_agg(json_build_object('id', d.id, 'name', d.name, 'slug', d.slug) ORDER BY pd.sort_order)
                          FROM product_destinations pd JOIN destinations d ON d.id = pd.destination_id
                         WHERE pd.product_id = p.id AND d.status = 'published'), '[]'::json) AS destinations,
              COALESCE((SELECT json_agg(json_build_object('id', a.id, 'name', a.name, 'slug', a.slug) ORDER BY a.name)
                          FROM product_activities pa JOIN activities a ON a.id = pa.activity_id
                         WHERE pa.product_id = p.id AND a.status = 'published'), '[]'::json) AS activities
         FROM products p
         LEFT JOIN product_categories c ON c.id = p.category_id
         LEFT JOIN media hm ON hm.id = p.hero_image_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.featured DESC, p.name
        LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({
        data: rows.rows.map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            summary: row.summary,
            highlights: row.highlights,
            durationDays: row.duration_days,
            durationNights: row.duration_nights,
            difficulty: row.difficulty,
            minTravellers: row.min_travellers,
            maxTravellers: row.max_travellers,
            featured: row.featured,
            category: row.category_name ? { name: row.category_name, slug: row.category_slug } : null,
            heroImageUrl: row.hero_bucket ? mediaUrl(row.hero_bucket, row.hero_path) : null,
            destinations: row.destinations,
            activities: row.activities,
            seoTitle: row.seo_title,
            seoDescription: row.seo_description,
            updatedAt: row.updated_at,
        })),
    });
}));
publicRouter.get('/products/:slug', asyncHandler(async (req, res) => {
    const db = getDb();
    const result = await db.query(`SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              hm.storage_bucket AS hero_bucket, hm.storage_path AS hero_path
         FROM products p
         LEFT JOIN product_categories c ON c.id = p.category_id
         LEFT JOIN media hm ON hm.id = p.hero_image_id
        WHERE p.slug = $1 AND p.status = 'published'`, [req.params.slug]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Product not found');
    const [destinations, activities, media, itinerary] = await Promise.all([
        db.query(`SELECT d.id, d.name, d.slug, d.summary, d.region
           FROM product_destinations pd JOIN destinations d ON d.id = pd.destination_id
          WHERE pd.product_id = $1 AND d.status = 'published' ORDER BY pd.sort_order`, [row.id]),
        db.query(`SELECT a.id, a.name, a.slug, a.category, a.summary
           FROM product_activities pa JOIN activities a ON a.id = pa.activity_id
          WHERE pa.product_id = $1 AND a.status = 'published' ORDER BY a.name`, [row.id]),
        db.query(`SELECT m.storage_bucket, m.storage_path, m.alt_text, m.file_name
           FROM product_media pm JOIN media m ON m.id = pm.media_id
          WHERE pm.product_id = $1 ORDER BY pm.sort_order`, [row.id]),
        db.query(`SELECT d.day_number, d.title, d.description, d.accommodation, d.meals
           FROM itinerary_days d JOIN itineraries i ON i.id = d.itinerary_id
          WHERE i.product_id = $1 ORDER BY d.day_number`, [row.id]),
    ]);
    res.json({
        data: {
            id: row.id,
            name: row.name,
            slug: row.slug,
            summary: row.summary,
            description: row.description,
            highlights: row.highlights,
            inclusions: row.inclusions,
            exclusions: row.exclusions,
            durationDays: row.duration_days,
            durationNights: row.duration_nights,
            difficulty: row.difficulty,
            minTravellers: row.min_travellers,
            maxTravellers: row.max_travellers,
            accommodationInfo: row.accommodation_info,
            featured: row.featured,
            category: row.category_name ? { name: row.category_name, slug: row.category_slug } : null,
            heroImageUrl: row.hero_bucket ? mediaUrl(row.hero_bucket, row.hero_path) : null,
            gallery: media.rows.map((item) => ({
                url: mediaUrl(item.storage_bucket, item.storage_path),
                alt: item.alt_text ?? item.file_name,
            })),
            destinations: destinations.rows,
            activities: activities.rows,
            itinerary: itinerary.rows.map((day) => ({
                day: day.day_number,
                title: day.title,
                description: day.description,
                accommodation: day.accommodation,
                meals: day.meals,
            })),
            seoTitle: row.seo_title,
            seoDescription: row.seo_description,
            updatedAt: row.updated_at,
        },
    });
}));
publicRouter.get('/destinations', asyncHandler(async (req, res) => {
    const db = getDb();
    const params = [];
    const conditions = ["d.status = 'published'"];
    if (typeof req.query.region === 'string' && req.query.region) {
        params.push(req.query.region);
        conditions.push(`d.region = $${params.length}`);
    }
    const rows = await db.query(`SELECT d.id, d.name, d.slug, d.region, d.country, d.summary, d.description, d.best_time,
              d.latitude, d.longitude, d.featured, d.seo_title, d.seo_description,
              m.storage_bucket, m.storage_path
         FROM destinations d LEFT JOIN media m ON m.id = d.hero_image_id
        WHERE ${conditions.join(' AND ')} ORDER BY d.featured DESC, d.name`, params);
    res.json({
        data: rows.rows.map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            region: row.region,
            country: row.country,
            summary: row.summary,
            description: row.description,
            bestTime: row.best_time,
            latitude: row.latitude,
            longitude: row.longitude,
            featured: row.featured,
            heroImageUrl: row.storage_bucket ? mediaUrl(row.storage_bucket, row.storage_path) : null,
            seoTitle: row.seo_title,
            seoDescription: row.seo_description,
        })),
    });
}));
publicRouter.get('/destinations/:slug', asyncHandler(async (req, res) => {
    const db = getDb();
    const result = await db.query(`SELECT d.*, m.storage_bucket, m.storage_path
         FROM destinations d LEFT JOIN media m ON m.id = d.hero_image_id
        WHERE d.slug = $1 AND d.status = 'published'`, [req.params.slug]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Destination not found');
    const products = await db.query(`SELECT p.id, p.name, p.slug, p.summary, p.duration_days, p.duration_nights,
              hm.storage_bucket AS hero_bucket, hm.storage_path AS hero_path
         FROM product_destinations pd
         JOIN products p ON p.id = pd.product_id AND p.status = 'published'
         LEFT JOIN media hm ON hm.id = p.hero_image_id
        WHERE pd.destination_id = $1 ORDER BY p.featured DESC, p.name`, [row.id]);
    res.json({
        data: {
            id: row.id,
            name: row.name,
            slug: row.slug,
            region: row.region,
            country: row.country,
            summary: row.summary,
            description: row.description,
            bestTime: row.best_time,
            latitude: row.latitude,
            longitude: row.longitude,
            featured: row.featured,
            heroImageUrl: row.storage_bucket ? mediaUrl(row.storage_bucket, row.storage_path) : null,
            seoTitle: row.seo_title,
            seoDescription: row.seo_description,
            products: products.rows.map((product) => ({
                id: product.id,
                name: product.name,
                slug: product.slug,
                summary: product.summary,
                durationDays: product.duration_days,
                durationNights: product.duration_nights,
                heroImageUrl: product.hero_bucket ? mediaUrl(product.hero_bucket, product.hero_path) : null,
            })),
        },
    });
}));
publicRouter.get('/activities', asyncHandler(async (_req, res) => {
    const db = getDb();
    const rows = await db.query(`SELECT a.id, a.name, a.slug, a.category, a.summary, a.description,
              m.storage_bucket, m.storage_path
         FROM activities a LEFT JOIN media m ON m.id = a.image_id
        WHERE a.status = 'published' ORDER BY a.name`);
    res.json({
        data: rows.rows.map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            category: row.category,
            summary: row.summary,
            description: row.description,
            imageUrl: row.storage_bucket ? mediaUrl(row.storage_bucket, row.storage_path) : null,
        })),
    });
}));
publicRouter.get('/pages/:slug', asyncHandler(async (req, res) => {
    const db = getDb();
    const result = await db.query(`SELECT slug, title, content, seo_title, seo_description, updated_at
         FROM website_pages WHERE slug = $1 AND status = 'published'`, [req.params.slug]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Page not found');
    res.json({
        data: {
            slug: row.slug,
            title: row.title,
            content: row.content,
            seoTitle: row.seo_title,
            seoDescription: row.seo_description,
            updatedAt: row.updated_at,
        },
    });
}));
publicRouter.get('/company', asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    const { company } = settings;
    res.json({
        data: {
            name: company.name,
            email: company.email,
            phone: company.phone,
            whatsapp: company.whatsapp,
            address: company.address,
            city: company.city,
            country: company.country,
            website: company.website,
            logoUrl: company.logoUrl,
        },
    });
}));
publicRouter.post('/enquiries', validate(publicEnquirySchema), asyncHandler(async (req, res) => {
    const input = req.body;
    // Honeypot: pretend success without writing anything.
    if (input.website && input.website.trim()) {
        res.status(201).json({ data: { reference: 'ENQ-RECEIVED', message: 'Thank you. We will be in touch shortly.' } });
        return;
    }
    if (config.turnstileSecret) {
        if (!input.turnstileToken)
            throw badRequest('Please complete the verification challenge.');
        const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: config.turnstileSecret,
                response: input.turnstileToken,
                remoteip: req.ip ?? '',
            }),
        });
        const result = (await verify.json());
        if (!result.success)
            throw badRequest('Verification failed. Please try again.');
    }
    const db = getDb();
    const created = await db.transaction(async (tx) => {
        let product = null;
        if (input.productId || input.productSlug) {
            const productResult = await tx.query(`SELECT id, name FROM products WHERE status = 'published' AND ${input.productId ? 'id = $1' : 'slug = $1'} LIMIT 1`, [input.productId ?? input.productSlug]);
            product = productResult.rows[0] ?? null;
        }
        const email = input.email?.trim().toLowerCase() ?? '';
        const phone = (input.phone ?? input.whatsapp ?? '').replace(/\D/g, '');
        let customerId = null;
        if (email || phone) {
            const match = await tx.query(`SELECT id FROM customers
            WHERE archived_at IS NULL AND (
              ($1 <> '' AND lower(email) = $1)
              OR ($2 <> '' AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $2)
              OR ($2 <> '' AND regexp_replace(COALESCE(whatsapp, ''), '\\D', '', 'g') = $2)
            )
            ORDER BY CASE WHEN $1 <> '' AND lower(email) = $1 THEN 0 ELSE 1 END, created_at
            LIMIT 1`, [email, phone]);
            customerId = match.rows[0]?.id ?? null;
        }
        if (!customerId) {
            const customerReference = await nextReference(tx, 'CUS');
            const result = await tx.query(`INSERT INTO customers (reference, first_name, last_name, email, phone, whatsapp, country, preferred_channel)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'email') RETURNING id`, [
                customerReference,
                input.firstName,
                input.lastName || '—',
                email || null,
                phone || null,
                input.whatsapp?.replace(/\s+/g, ' ').trim() || phone || null,
                input.country ?? null,
            ]);
            customerId = result.rows[0].id;
            await logAudit(tx, {
                actor: null,
                action: 'customer.created',
                entityType: 'customer',
                entityId: customerId,
                changes: { source: 'website', reference: customerReference },
                ...requestAuditContext(req),
            });
        }
        const extras = [];
        if (input.interest)
            extras.push(`Interest: ${input.interest}`);
        if (input.budget)
            extras.push(`Budget range: ${input.budget}`);
        if (input.travellers)
            extras.push(`Travellers: ${input.travellers}`);
        const requirements = [input.specialRequirements ?? input.message, ...extras].filter(Boolean).join('\n\n') || null;
        const enquiryReference = await nextReference(tx, 'ENQ');
        const startDate = input.travelDateStart ?? input.travelDate ?? null;
        const result = await tx.query(`INSERT INTO enquiries
          (reference, customer_id, product_id, source, status, travel_date_start, travel_date_end, flexible_dates,
           adults, children, country, accommodation_preference, budget_amount, budget_currency, special_requirements)
         VALUES ($1,$2,$3,'website','new',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, [
            enquiryReference,
            customerId,
            product?.id ?? null,
            startDate,
            input.travelDateEnd ?? null,
            input.flexibleDates,
            input.adults,
            input.children,
            input.country ?? null,
            input.accommodationPreference ?? input.accommodation ?? null,
            input.budgetAmount ?? null,
            input.budgetCurrency,
            requirements,
        ]);
        const enquiryId = result.rows[0].id;
        await logAudit(tx, {
            actor: null,
            action: 'enquiry.created',
            entityType: 'enquiry',
            entityId: enquiryId,
            changes: { reference: enquiryReference, source: 'website', product: product?.name ?? null },
            ...requestAuditContext(req),
        });
        return { enquiryId, reference: enquiryReference, productName: product?.name ?? null };
    });
    // Notification is best-effort; the enquiry is already safely stored.
    try {
        const settings = await getSettings();
        if (settings.notifications.notifyOnEnquiry && settings.notifications.enquiryEmail) {
            await sendEmail({
                to: settings.notifications.enquiryEmail,
                subject: `New website enquiry ${created.reference}`,
                text: `${input.firstName} ${input.lastName} sent a new enquiry${created.productName ? ` about ${created.productName}` : ''}.\n\nEmail: ${input.email ?? '—'}\nPhone: ${input.phone ?? '—'}\n\nOpen the TMS to follow up.`,
                html: `<p><strong>${escapeHtml(input.firstName)} ${escapeHtml(input.lastName)}</strong> sent a new enquiry${created.productName ? ` about <strong>${escapeHtml(created.productName)}</strong>` : ''}.</p><p>Email: ${escapeHtml(input.email ?? '—')}<br>Phone: ${escapeHtml(input.phone ?? '—')}</p><p>Open the TMS to follow up.</p>`,
            });
        }
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error('Enquiry notification failed', error);
    }
    res.status(201).json({
        data: {
            reference: created.reference,
            message: 'Thank you. Your enquiry has been received and we will respond within 24 hours.',
        },
    });
}));
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[character];
    });
}
