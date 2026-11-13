import { enquiryCreateSchema, enquiryNoteSchema, enquiryUpdateSchema, interactionCreateSchema, } from '@erniza/shared';
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, badRequest, notFound, unprocessable } from '../../lib/errors.js';
import { escapeLike, paginationMeta, parsePagination, queryDate, queryString } from '../../lib/pagination.js';
import { nextReference } from '../../lib/reference.js';
import { requireAuth } from '../../middleware/auth.js';
import { providedKeys, validate } from '../../middleware/validate.js';
import { getSettings } from '../../services/settings.js';
export const enquiriesRouter = Router();
enquiriesRouter.use(requireAuth);
enquiriesRouter.get('/', asyncHandler(async (req, res) => {
    const { page, pageSize, offset, q } = parsePagination(req);
    const status = queryString(req, 'status');
    const source = queryString(req, 'source');
    const followUp = queryString(req, 'followUp');
    const from = queryDate(req, 'from');
    const to = queryDate(req, 'to');
    const productId = queryString(req, 'productId');
    const params = [];
    const conditions = [];
    if (status) {
        const statuses = status.split(',').filter(Boolean);
        params.push(statuses);
        conditions.push(`e.status = ANY($${params.length})`);
    }
    if (source) {
        params.push(source);
        conditions.push(`e.source = $${params.length}`);
    }
    if (productId) {
        params.push(productId);
        conditions.push(`e.product_id = $${params.length}`);
    }
    if (from) {
        params.push(from);
        conditions.push(`e.created_at >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        conditions.push(`e.created_at < ($${params.length}::date + interval '1 day')`);
    }
    if (followUp === 'overdue') {
        conditions.push(`e.follow_up_date IS NOT NULL AND e.follow_up_date <= current_date AND e.status NOT IN ('converted','lost')`);
    }
    else if (followUp === 'scheduled') {
        conditions.push(`e.follow_up_date IS NOT NULL AND e.status NOT IN ('converted','lost')`);
    }
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(e.reference ILIKE $${params.length} OR c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const [count, rows] = await Promise.all([
        db.query(`SELECT count(*)::int AS total FROM enquiries e
           JOIN customers c ON c.id = e.customer_id
           LEFT JOIN products p ON p.id = e.product_id ${where}`, params),
        db.query(`SELECT e.*, c.first_name, c.last_name, c.email AS customer_email, c.phone AS customer_phone,
                p.name AS product_name
           FROM enquiries e
           JOIN customers c ON c.id = e.customer_id
           LEFT JOIN products p ON p.id = e.product_id
           ${where}
          ORDER BY CASE e.status WHEN 'new' THEN 0 WHEN 'follow_up' THEN 1 ELSE 2 END, e.created_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]),
    ]);
    res.json({ data: rows.rows.map(mapEnquiry), meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0) });
}));
enquiriesRouter.post('/', validate(enquiryCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    validateDates(input.travelDateStart, input.travelDateEnd);
    const actor = req.authUser;
    const db = getDb();
    const id = await db.transaction(async (tx) => {
        const customer = await tx.query('SELECT id FROM customers WHERE id = $1', [input.customerId]);
        if (!customer.rows[0])
            throw unprocessable('Select a valid customer.');
        const reference = await nextReference(tx, 'ENQ');
        const result = await tx.query(`INSERT INTO enquiries
          (reference, customer_id, product_id, source, status, travel_date_start, travel_date_end, flexible_dates,
           adults, children, country, accommodation_preference, budget_amount, budget_currency,
           special_requirements, internal_notes, follow_up_date, assigned_to)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`, [
            reference,
            input.customerId,
            input.productId ?? null,
            input.source,
            input.status,
            input.travelDateStart ?? null,
            input.travelDateEnd ?? null,
            input.flexibleDates,
            input.adults,
            input.children,
            input.country ?? null,
            input.accommodationPreference ?? null,
            input.budgetAmount ?? null,
            input.budgetCurrency,
            input.specialRequirements ?? null,
            input.internalNotes ?? null,
            input.followUpDate ?? null,
            actor.id,
        ]);
        const createdId = result.rows[0].id;
        await logAudit(tx, {
            actor,
            action: 'enquiry.created',
            entityType: 'enquiry',
            entityId: createdId,
            changes: { reference, source: input.source, status: input.status },
            ...requestAuditContext(req),
        });
        return createdId;
    });
    res.status(201).json({ data: await loadEnquiry(id) });
}));
enquiriesRouter.get('/:id', asyncHandler(async (req, res) => {
    res.json({ data: await loadEnquiry(req.params.id) });
}));
enquiriesRouter.patch('/:id', validate(enquiryUpdateSchema), asyncHandler(async (req, res) => {
    const allInput = req.body;
    const keys = new Set(providedKeys(req) ?? Object.keys(allInput));
    const input = Object.fromEntries(Object.entries(allInput).filter(([key]) => keys.has(key)));
    validateDates(input.travelDateStart, input.travelDateEnd);
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT id, status FROM enquiries WHERE id = $1', [
            req.params.id,
        ]);
        const current = existing.rows[0];
        if (!current)
            throw notFound('Enquiry not found');
        const map = {
            productId: 'product_id',
            source: 'source',
            status: 'status',
            travelDateStart: 'travel_date_start',
            travelDateEnd: 'travel_date_end',
            flexibleDates: 'flexible_dates',
            adults: 'adults',
            children: 'children',
            country: 'country',
            accommodationPreference: 'accommodation_preference',
            budgetAmount: 'budget_amount',
            budgetCurrency: 'budget_currency',
            specialRequirements: 'special_requirements',
            internalNotes: 'internal_notes',
            followUpDate: 'follow_up_date',
            lostReason: 'lost_reason',
            assignedTo: 'assigned_to',
        };
        const fields = [];
        const values = [];
        for (const [key, column] of Object.entries(map)) {
            if (key in input) {
                values.push(input[key] ?? null);
                fields.push(`${column} = $${values.length}`);
            }
        }
        if (input.status === 'converted') {
            values.push(new Date());
            fields.push(`converted_at = $${values.length}`);
        }
        if (!fields.length)
            return;
        values.push(req.params.id);
        await tx.query(`UPDATE enquiries SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
        if (input.status && input.status !== current.status) {
            await logAudit(tx, {
                actor,
                action: 'enquiry.status_changed',
                entityType: 'enquiry',
                entityId: req.params.id,
                changes: { from: current.status, to: input.status },
                ...requestAuditContext(req),
            });
            await tx.query(`INSERT INTO customer_interactions (customer_id, enquiry_id, type, summary, occurred_at, created_by)
           SELECT customer_id, id, 'note', $1, now(), $2 FROM enquiries WHERE id = $3`, [`Status changed from ${current.status} to ${input.status}`, actor.id, req.params.id]);
        }
        else {
            await logAudit(tx, {
                actor,
                action: 'enquiry.updated',
                entityType: 'enquiry',
                entityId: req.params.id,
                changes: input,
                ...requestAuditContext(req),
            });
        }
    });
    res.json({ data: await loadEnquiry(req.params.id) });
}));
enquiriesRouter.post('/:id/notes', validate(enquiryNoteSchema), asyncHandler(async (req, res) => {
    const { note } = req.body;
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const enquiry = await tx.query('SELECT id FROM enquiries WHERE id = $1', [req.params.id]);
        if (!enquiry.rows[0])
            throw notFound('Enquiry not found');
        await tx.query('INSERT INTO enquiry_notes (enquiry_id, author_id, note) VALUES ($1,$2,$3)', [
            req.params.id,
            actor.id,
            note,
        ]);
        await logAudit(tx, {
            actor,
            action: 'enquiry.note_added',
            entityType: 'enquiry',
            entityId: req.params.id,
            changes: { note },
            ...requestAuditContext(req),
        });
    });
    res.status(201).json({ data: await loadEnquiry(req.params.id) });
}));
enquiriesRouter.post('/:id/interactions', validate(interactionCreateSchema.omit({ customerId: true })), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const enquiry = await tx.query('SELECT customer_id FROM enquiries WHERE id = $1', [
            req.params.id,
        ]);
        const record = enquiry.rows[0];
        if (!record)
            throw notFound('Enquiry not found');
        await tx.query(`INSERT INTO customer_interactions (customer_id, enquiry_id, type, summary, occurred_at, created_by)
         VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, now()),$6)`, [record.customer_id, req.params.id, input.type, input.summary, input.occurredAt ?? null, actor.id]);
        await logAudit(tx, {
            actor,
            action: 'enquiry.interaction_recorded',
            entityType: 'enquiry',
            entityId: req.params.id,
            changes: { type: input.type, summary: input.summary },
            ...requestAuditContext(req),
        });
    });
    res.status(201).json({ data: await loadEnquiry(req.params.id) });
}));
enquiriesRouter.post('/:id/convert-to-quotation', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    const quotationId = await db.transaction(async (tx) => {
        const enquiryResult = await tx.query(`SELECT e.*, c.id AS customer_id_check, p.name AS product_name
           FROM enquiries e
           JOIN customers c ON c.id = e.customer_id
           LEFT JOIN products p ON p.id = e.product_id
          WHERE e.id = $1`, [req.params.id]);
        const enquiry = enquiryResult.rows[0];
        if (!enquiry)
            throw notFound('Enquiry not found');
        if (enquiry.status === 'converted')
            throw badRequest('This enquiry has already been converted.');
        const settings = await getSettings(tx);
        const reference = await nextReference(tx, 'QUO');
        const validity = new Date();
        validity.setDate(validity.getDate() + settings.billing.quotationValidityDays);
        let itinerary = enquiry.special_requirements ?? null;
        if (enquiry.product_id) {
            const days = await tx.query(`SELECT d.day_number, d.title, d.description
             FROM itinerary_days d JOIN itineraries i ON i.id = d.itinerary_id
            WHERE i.product_id = $1 ORDER BY d.day_number`, [enquiry.product_id]);
            if (days.rows.length) {
                itinerary = days.rows
                    .map((day) => `Day ${day.day_number}: ${day.title}${day.description ? ` — ${day.description}` : ''}`)
                    .join('\n');
            }
        }
        const result = await tx.query(`INSERT INTO quotations
          (reference, customer_id, enquiry_id, primary_product_id, status, currency, travel_date_start, travel_date_end,
           adults, children, accommodation, itinerary, special_arrangements, payment_terms, validity_until, notes, created_by, updated_by)
         VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) RETURNING id`, [
            reference,
            enquiry.customer_id,
            enquiry.id,
            enquiry.product_id,
            enquiry.budget_currency || settings.billing.defaultCurrency,
            enquiry.travel_date_start,
            enquiry.travel_date_end,
            enquiry.adults,
            enquiry.children,
            enquiry.accommodation_preference,
            itinerary,
            enquiry.special_requirements,
            settings.billing.defaultPaymentTerms,
            validity.toISOString().slice(0, 10),
            null,
            actor.id,
        ]);
        const createdId = result.rows[0].id;
        await tx.query(`UPDATE enquiries SET status = 'quotation_in_progress', updated_at = now() WHERE id = $1`, [enquiry.id]);
        await logAudit(tx, {
            actor,
            action: 'quotation.created',
            entityType: 'quotation',
            entityId: createdId,
            changes: { reference, fromEnquiry: enquiry.reference },
            ...requestAuditContext(req),
        });
        await logAudit(tx, {
            actor,
            action: 'enquiry.status_changed',
            entityType: 'enquiry',
            entityId: enquiry.id,
            changes: { from: enquiry.status, to: 'quotation_in_progress' },
            ...requestAuditContext(req),
        });
        return createdId;
    });
    res.status(201).json({ data: { quotationId } });
}));
async function loadEnquiry(id) {
    const db = getDb();
    const result = await db.query(`SELECT e.*, c.first_name, c.last_name, c.email AS customer_email, c.phone AS customer_phone,
            c.country AS customer_country, c.preferred_channel, p.name AS product_name
       FROM enquiries e
       JOIN customers c ON c.id = e.customer_id
       LEFT JOIN products p ON p.id = e.product_id
      WHERE e.id = $1`, [id]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Enquiry not found');
    const [notes, interactions, quotations, audit] = await Promise.all([
        db.query(`SELECT n.*, u.full_name AS author_name FROM enquiry_notes n
         LEFT JOIN admin_users u ON u.id = n.author_id
        WHERE n.enquiry_id = $1 ORDER BY n.created_at DESC`, [id]),
        db.query(`SELECT i.*, u.full_name AS author_name FROM customer_interactions i
         LEFT JOIN admin_users u ON u.id = i.created_by
        WHERE i.enquiry_id = $1 ORDER BY i.occurred_at DESC`, [id]),
        db.query(`SELECT q.id, q.reference, q.status, q.currency, q.total, q.current_version, q.created_at, q.validity_until
         FROM quotations q WHERE q.enquiry_id = $1 ORDER BY q.created_at DESC`, [id]),
        db.query(`SELECT a.id, a.action, a.actor_email, a.changes, a.created_at
         FROM audit_logs a WHERE a.entity_type = 'enquiry' AND a.entity_id = $1 ORDER BY a.created_at DESC LIMIT 100`, [id]),
    ]);
    return {
        ...mapEnquiry(row),
        country: row.country,
        flexibleDates: row.flexible_dates,
        accommodationPreference: row.accommodation_preference,
        specialRequirements: row.special_requirements,
        internalNotes: row.internal_notes,
        lostReason: row.lost_reason,
        convertedAt: row.converted_at,
        customerCountry: row.customer_country,
        customerPreferredChannel: row.preferred_channel,
        notes: notes.rows.map((note) => ({
            id: note.id,
            note: note.note,
            authorName: note.author_name,
            createdAt: note.created_at,
        })),
        interactions: interactions.rows.map((item) => ({
            id: item.id,
            customerId: item.customer_id,
            enquiryId: item.enquiry_id,
            type: item.type,
            summary: item.summary,
            occurredAt: item.occurred_at,
            authorName: item.author_name,
            createdAt: item.created_at,
        })),
        quotations: quotations.rows.map((quotation) => ({
            id: quotation.id,
            reference: quotation.reference,
            status: quotation.status,
            currency: quotation.currency,
            total: quotation.total,
            currentVersion: quotation.current_version,
            createdAt: quotation.created_at,
            validityUntil: quotation.validity_until,
        })),
        auditLogs: audit.rows.map((item) => ({
            id: String(item.id),
            action: item.action,
            actorEmail: item.actor_email,
            changes: item.changes,
            createdAt: item.created_at,
        })),
    };
}
function mapEnquiry(row) {
    return {
        id: row.id,
        reference: row.reference,
        customerId: row.customer_id,
        customerName: `${row.first_name} ${row.last_name}`,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        productId: row.product_id,
        productName: row.product_name,
        source: row.source,
        status: row.status,
        travelDateStart: row.travel_date_start,
        travelDateEnd: row.travel_date_end,
        adults: row.adults,
        children: row.children,
        budgetAmount: row.budget_amount,
        budgetCurrency: row.budget_currency,
        followUpDate: row.follow_up_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function validateDates(start, end) {
    if (start && end && end < start)
        throw unprocessable('The return date cannot be before the departure date.');
}
