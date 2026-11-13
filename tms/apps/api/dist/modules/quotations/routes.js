import { quotationAcceptSchema, quotationCreateSchema, quotationUpdateSchema, } from '@erniza/shared';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, badRequest, conflict, notFound, unprocessable } from '../../lib/errors.js';
import { escapeLike, paginationMeta, parsePagination, queryDate, queryString } from '../../lib/pagination.js';
import { nextReference } from '../../lib/reference.js';
import { requireAuth } from '../../middleware/auth.js';
import { providedKeys, validate } from '../../middleware/validate.js';
import { getSettings } from '../../services/settings.js';
import { renderQuotationPdf } from '../../services/pdf.js';
import { createQuotationVersion, expireQuotations, loadQuotation, writeQuotationItems, } from './service.js';
export const quotationsRouter = Router();
quotationsRouter.use(requireAuth);
quotationsRouter.get('/', asyncHandler(async (req, res) => {
    await expireQuotations();
    const { page, pageSize, offset, q } = parsePagination(req);
    const status = queryString(req, 'status');
    const customerId = queryString(req, 'customerId');
    const enquiryId = queryString(req, 'enquiryId');
    const from = queryDate(req, 'from');
    const to = queryDate(req, 'to');
    const params = [];
    const conditions = [];
    if (status) {
        params.push(status.split(',').filter(Boolean));
        conditions.push(`q.status = ANY($${params.length})`);
    }
    if (customerId) {
        params.push(customerId);
        conditions.push(`q.customer_id = $${params.length}`);
    }
    if (enquiryId) {
        params.push(enquiryId);
        conditions.push(`q.enquiry_id = $${params.length}`);
    }
    if (from) {
        params.push(from);
        conditions.push(`q.created_at >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        conditions.push(`q.created_at < ($${params.length}::date + interval '1 day')`);
    }
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(q.reference ILIKE $${params.length} OR c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.email ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const [count, rows] = await Promise.all([
        db.query(`SELECT count(*)::int AS total FROM quotations q JOIN customers c ON c.id = q.customer_id ${where}`, params),
        db.query(`SELECT q.*, c.first_name, c.last_name, c.email AS customer_email, e.reference AS enquiry_reference,
                b.id AS booking_id, b.reference AS booking_reference
           FROM quotations q
           JOIN customers c ON c.id = q.customer_id
           LEFT JOIN enquiries e ON e.id = q.enquiry_id
           LEFT JOIN bookings b ON b.quotation_id = q.id
           ${where}
          ORDER BY q.updated_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]),
    ]);
    res.json({
        data: rows.rows.map((row) => ({
            id: row.id,
            reference: row.reference,
            customerId: row.customer_id,
            customerName: `${row.first_name} ${row.last_name}`,
            customerEmail: row.customer_email,
            enquiryId: row.enquiry_id,
            enquiryReference: row.enquiry_reference,
            primaryProductId: row.primary_product_id,
            status: row.status,
            currentVersion: row.current_version,
            currency: row.currency,
            total: row.total,
            travelDateStart: row.travel_date_start,
            travelDateEnd: row.travel_date_end,
            validityUntil: row.validity_until,
            issuedAt: row.issued_at,
            bookingId: row.booking_id,
            bookingReference: row.booking_reference,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        })),
        meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0),
    });
}));
quotationsRouter.post('/', validate(quotationCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    validateTravelDates(input.travelDateStart, input.travelDateEnd);
    const actor = req.authUser;
    const db = getDb();
    const id = await db.transaction(async (tx) => {
        const customer = await tx.query('SELECT id FROM customers WHERE id = $1', [input.customerId]);
        if (!customer.rows[0])
            throw unprocessable('Select a valid customer.');
        if (input.enquiryId) {
            const enquiry = await tx.query('SELECT customer_id FROM enquiries WHERE id = $1', [
                input.enquiryId,
            ]);
            if (!enquiry.rows[0])
                throw unprocessable('Select a valid enquiry.');
            if (enquiry.rows[0].customer_id !== input.customerId) {
                throw unprocessable('The selected enquiry belongs to a different customer.');
            }
        }
        const settings = await getSettings(tx);
        const validity = input.validityUntil ??
            new Date(Date.now() + settings.billing.quotationValidityDays * 86_400_000).toISOString().slice(0, 10);
        const reference = await nextReference(tx, 'QUO');
        const result = await tx.query(`INSERT INTO quotations
          (reference, customer_id, enquiry_id, primary_product_id, status, currency, travel_date_start, travel_date_end,
           adults, children, accommodation, itinerary, special_arrangements, payment_terms, validity_until, notes,
           created_by, updated_by)
         VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) RETURNING id`, [
            reference,
            input.customerId,
            input.enquiryId ?? null,
            input.primaryProductId ?? null,
            input.currency,
            input.travelDateStart ?? null,
            input.travelDateEnd ?? null,
            input.adults,
            input.children,
            input.accommodation ?? null,
            input.itinerary ?? null,
            input.specialArrangements ?? null,
            input.paymentTerms ?? settings.billing.defaultPaymentTerms,
            validity,
            input.notes ?? null,
            actor.id,
        ]);
        const createdId = result.rows[0].id;
        await writeQuotationItems(tx, createdId, input.items, input.discountAmount, input.taxRate);
        if (input.enquiryId) {
            await tx.query(`UPDATE enquiries SET status = CASE WHEN status = 'converted' THEN status ELSE 'quotation_in_progress' END,
                  updated_at = now() WHERE id = $1`, [input.enquiryId]);
        }
        await logAudit(tx, {
            actor,
            action: 'quotation.created',
            entityType: 'quotation',
            entityId: createdId,
            changes: { reference, currency: input.currency },
            ...requestAuditContext(req),
        });
        return createdId;
    });
    res.status(201).json({ data: await loadQuotation(id) });
}));
quotationsRouter.get('/:id', asyncHandler(async (req, res) => {
    await expireQuotations();
    res.json({ data: await loadQuotation(req.params.id) });
}));
quotationsRouter.patch('/:id', validate(quotationUpdateSchema), asyncHandler(async (req, res) => {
    const allInput = req.body;
    const keys = new Set(providedKeys(req) ?? Object.keys(allInput));
    const input = Object.fromEntries(Object.entries(allInput).filter(([key]) => keys.has(key)));
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT * FROM quotations WHERE id = $1 FOR UPDATE', [
            req.params.id,
        ]);
        const current = existing.rows[0];
        if (!current)
            throw notFound('Quotation not found');
        if (!['draft', 'revised'].includes(current.status)) {
            throw conflict('Issued quotations are locked. Create a revision before making changes.');
        }
        const start = input.travelDateStart ?? current.travel_date_start;
        const end = input.travelDateEnd ?? current.travel_date_end;
        validateTravelDates(start ?? undefined, end ?? undefined);
        const map = {
            primaryProductId: 'primary_product_id',
            currency: 'currency',
            travelDateStart: 'travel_date_start',
            travelDateEnd: 'travel_date_end',
            adults: 'adults',
            children: 'children',
            accommodation: 'accommodation',
            itinerary: 'itinerary',
            specialArrangements: 'special_arrangements',
            paymentTerms: 'payment_terms',
            validityUntil: 'validity_until',
            notes: 'notes',
        };
        const fields = [];
        const values = [];
        for (const [key, column] of Object.entries(map)) {
            if (key in input) {
                values.push(input[key] ?? null);
                fields.push(`${column} = $${values.length}`);
            }
        }
        if (fields.length) {
            values.push(actor.id, req.params.id);
            await tx.query(`UPDATE quotations SET ${fields.join(', ')}, updated_by = $${values.length - 1}, updated_at = now() WHERE id = $${values.length}`, values);
        }
        if (input.items !== undefined || input.discountAmount !== undefined || input.taxRate !== undefined) {
            const items = input.items ??
                (await tx.query('SELECT description, quantity, unit_price FROM quotation_items WHERE quotation_id = $1 ORDER BY sort_order', [req.params.id])).rows.map((item) => ({ description: item.description, quantity: item.quantity, unitPrice: item.unit_price }));
            await writeQuotationItems(tx, req.params.id, items, input.discountAmount ?? current.discount_amount, input.taxRate ?? current.tax_rate);
        }
        await logAudit(tx, {
            actor,
            action: 'quotation.updated',
            entityType: 'quotation',
            entityId: req.params.id,
            changes: { fields: Object.keys(input) },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadQuotation(req.params.id) });
}));
quotationsRouter.post('/:id/issue', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT * FROM quotations WHERE id = $1 FOR UPDATE', [
            req.params.id,
        ]);
        const quotation = existing.rows[0];
        if (!quotation)
            throw notFound('Quotation not found');
        if (!['draft', 'revised'].includes(quotation.status)) {
            throw conflict('Only draft or revised quotations can be issued.');
        }
        const items = await tx.query('SELECT count(*)::int AS count FROM quotation_items WHERE quotation_id = $1', [req.params.id]);
        if ((items.rows[0]?.count ?? 0) === 0)
            throw badRequest('Add at least one line item before issuing.');
        if (Number(quotation.total) <= 0)
            throw badRequest('The quotation total must be greater than zero before issuing.');
        if (quotation.validity_until && quotation.validity_until < new Date().toISOString().slice(0, 10)) {
            throw badRequest('The validity date has passed. Update the validity period before issuing.');
        }
        const version = await createQuotationVersion(tx, req.params.id, 'issued');
        await tx.query(`UPDATE quotations SET status = 'sent', issued_at = now(), rejected_at = NULL, accepted_at = NULL, updated_by = $2, updated_at = now()
         WHERE id = $1`, [req.params.id, actor.id]);
        if (quotation.enquiry_id) {
            await tx.query(`UPDATE enquiries SET status = CASE WHEN status = 'converted' THEN status ELSE 'quotation_sent' END, updated_at = now() WHERE id = $1`, [quotation.enquiry_id]);
        }
        await logAudit(tx, {
            actor,
            action: 'quotation.issued',
            entityType: 'quotation',
            entityId: req.params.id,
            changes: { version: version.versionNumber, total: quotation.total, currency: quotation.currency },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadQuotation(req.params.id) });
}));
quotationsRouter.post('/:id/revise', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT * FROM quotations WHERE id = $1 FOR UPDATE', [
            req.params.id,
        ]);
        const quotation = existing.rows[0];
        if (!quotation)
            throw notFound('Quotation not found');
        if (quotation.status === 'accepted')
            throw conflict('Accepted quotations cannot be revised because a booking exists.');
        if (!['sent', 'rejected', 'expired'].includes(quotation.status)) {
            throw conflict('Only sent, rejected or expired quotations can be revised.');
        }
        await tx.query(`UPDATE quotation_versions SET status = 'superseded' WHERE quotation_id = $1 AND version_number = $2`, [req.params.id, quotation.current_version]);
        const nextVersion = quotation.current_version + 1;
        await tx.query(`UPDATE quotations SET status = 'revised', current_version = $2, revised_at = now(), issued_at = NULL,
                rejected_at = NULL, accepted_at = NULL, updated_by = $3, updated_at = now()
         WHERE id = $1`, [req.params.id, nextVersion, actor.id]);
        if (quotation.enquiry_id) {
            await tx.query(`UPDATE enquiries SET status = CASE WHEN status = 'converted' THEN status ELSE 'quotation_in_progress' END, updated_at = now() WHERE id = $1`, [quotation.enquiry_id]);
        }
        await logAudit(tx, {
            actor,
            action: 'quotation.revised',
            entityType: 'quotation',
            entityId: req.params.id,
            changes: { fromVersion: quotation.current_version, toVersion: nextVersion },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadQuotation(req.params.id) });
}));
quotationsRouter.post('/:id/reject', validate(z.object({ reason: z.string().trim().max(2000).optional() })), asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const reason = req.body.reason ?? null;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT * FROM quotations WHERE id = $1 FOR UPDATE', [
            req.params.id,
        ]);
        const quotation = existing.rows[0];
        if (!quotation)
            throw notFound('Quotation not found');
        if (quotation.status !== 'sent')
            throw conflict('Only sent quotations can be marked as rejected.');
        await tx.query(`UPDATE quotations SET status = 'rejected', rejected_at = now(), updated_by = $2, updated_at = now() WHERE id = $1`, [req.params.id, actor.id]);
        await tx.query(`UPDATE quotation_versions SET status = 'rejected' WHERE quotation_id = $1 AND version_number = $2`, [req.params.id, quotation.current_version]);
        if (quotation.enquiry_id) {
            await tx.query(`UPDATE enquiries SET status = CASE WHEN status = 'converted' THEN status ELSE 'follow_up' END, updated_at = now() WHERE id = $1`, [quotation.enquiry_id]);
        }
        await logAudit(tx, {
            actor,
            action: 'quotation.rejected',
            entityType: 'quotation',
            entityId: req.params.id,
            changes: { reason },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadQuotation(req.params.id) });
}));
quotationsRouter.post('/:id/accept', validate(quotationAcceptSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    const booking = await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT * FROM quotations WHERE id = $1 FOR UPDATE', [
            req.params.id,
        ]);
        const quotation = existing.rows[0];
        if (!quotation)
            throw notFound('Quotation not found');
        if (quotation.status === 'accepted') {
            const booking = await tx.query('SELECT id, reference FROM bookings WHERE quotation_id = $1', [req.params.id]);
            throw conflict('This quotation has already been accepted.', booking.rows[0] ?? undefined);
        }
        if (quotation.status !== 'sent')
            throw conflict('Only a sent quotation can be accepted.');
        if (quotation.validity_until && quotation.validity_until < new Date().toISOString().slice(0, 10)) {
            await tx.query("UPDATE quotations SET status = 'expired', updated_at = now() WHERE id = $1", [req.params.id]);
            throw conflict('This quotation has expired. Create a revision with updated pricing.');
        }
        const version = await tx.query(`SELECT * FROM quotation_versions WHERE quotation_id = $1 AND version_number = $2`, [req.params.id, quotation.current_version]);
        const versionRow = version.rows[0];
        if (!versionRow)
            throw conflict('The issued quotation version could not be found.');
        const snapshot = versionRow.snapshot;
        const start = input.travelDateStart ?? quotation.travel_date_start;
        const end = input.travelDateEnd ?? quotation.travel_date_end;
        if (!start || !end)
            throw badRequest('Enter the confirmed travel dates before accepting.');
        validateTravelDates(start, end);
        const adults = input.adults ?? quotation.adults;
        const children = input.children ?? quotation.children;
        const customer = await tx.query('SELECT * FROM customers WHERE id = $1', [
            quotation.customer_id,
        ]);
        const customerRow = customer.rows[0];
        const bookingReference = await nextReference(tx, 'BKG');
        const bookingSnapshot = {
            ...snapshot,
            acceptedAt: new Date().toISOString(),
            acceptedBy: actor.email,
            confirmedTravelDates: { start, end },
            customer: {
                id: customerRow.id,
                reference: customerRow.reference,
                firstName: customerRow.first_name,
                lastName: customerRow.last_name,
                email: customerRow.email,
                phone: customerRow.phone,
                whatsapp: customerRow.whatsapp,
                country: customerRow.country,
            },
            commercialTerms: {
                currency: quotation.currency,
                total: quotation.total,
                subtotal: quotation.subtotal,
                discountAmount: quotation.discount_amount,
                taxAmount: quotation.tax_amount,
                paymentTerms: quotation.payment_terms,
                items: snapshot.items,
            },
        };
        const bookingResult = await tx.query(`INSERT INTO bookings
          (reference, customer_id, quotation_id, quotation_version_id, product_id, status, travel_date_start, travel_date_end,
           adults, children, currency, total_amount, accommodation, itinerary, special_requirements, snapshot, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,'pending_confirmation',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) RETURNING id`, [
            bookingReference,
            quotation.customer_id,
            quotation.id,
            versionRow.id,
            quotation.primary_product_id,
            start,
            end,
            adults,
            children,
            quotation.currency,
            quotation.total,
            quotation.accommodation,
            quotation.itinerary,
            quotation.special_arrangements,
            JSON.stringify(bookingSnapshot),
            actor.id,
        ]);
        const bookingId = bookingResult.rows[0].id;
        const travellers = input.travellers?.length
            ? input.travellers
            : [
                {
                    firstName: customerRow.first_name,
                    lastName: customerRow.last_name,
                    email: customerRow.email ?? undefined,
                    phone: customerRow.phone ?? undefined,
                    nationality: customerRow.country ?? undefined,
                    passportNumber: undefined,
                },
            ];
        for (let index = 0; index < travellers.length; index += 1) {
            const traveller = travellers[index];
            await tx.query(`INSERT INTO booking_travellers (booking_id, first_name, last_name, email, phone, nationality, passport_number, is_lead)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
                bookingId,
                traveller.firstName,
                traveller.lastName,
                traveller.email ?? null,
                traveller.phone ?? null,
                traveller.nationality ?? null,
                traveller.passportNumber ?? null,
                index === 0,
            ]);
        }
        const itineraryDays = Array.isArray(snapshot.itineraryDays) ? snapshot.itineraryDays : [];
        for (const day of itineraryDays) {
            await tx.query(`INSERT INTO booking_itineraries (booking_id, day_number, title, description, accommodation, meals)
           VALUES ($1,$2,$3,$4,$5,$6)`, [
                bookingId,
                Number(day.day_number),
                String(day.title ?? `Day ${day.day_number}`),
                day.description ?? null,
                day.accommodation ?? null,
                day.meals ?? null,
            ]);
        }
        await tx.query(`UPDATE quotations SET status = 'accepted', accepted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1`, [req.params.id, actor.id]);
        await tx.query(`UPDATE quotation_versions SET status = 'accepted' WHERE id = $1`, [versionRow.id]);
        if (quotation.enquiry_id) {
            await tx.query(`UPDATE enquiries SET status = 'converted', converted_at = now(), updated_at = now() WHERE id = $1`, [quotation.enquiry_id]);
            await tx.query(`INSERT INTO customer_interactions (customer_id, enquiry_id, type, summary, occurred_at, created_by)
           VALUES ($1,$2,'note',$3,now(),$4)`, [
                quotation.customer_id,
                quotation.enquiry_id,
                `Quotation ${quotation.reference} accepted. Booking ${bookingReference} created.`,
                actor.id,
            ]);
        }
        await logAudit(tx, {
            actor,
            action: 'quotation.accepted',
            entityType: 'quotation',
            entityId: req.params.id,
            changes: { version: quotation.current_version, total: quotation.total, currency: quotation.currency },
            ...requestAuditContext(req),
        });
        await logAudit(tx, {
            actor,
            action: 'booking.created',
            entityType: 'booking',
            entityId: bookingId,
            changes: { reference: bookingReference, quotation: quotation.reference, total: quotation.total },
            ...requestAuditContext(req),
        });
        return { id: bookingId, reference: bookingReference };
    });
    res.status(201).json({ data: booking });
}));
quotationsRouter.get('/:id/pdf', asyncHandler(async (req, res) => {
    await renderQuotationPdf(req.params.id, res, queryString(req, 'version'));
}));
quotationsRouter.get('/:id/versions/:versionId', asyncHandler(async (req, res) => {
    const db = getDb();
    const result = await db.query(`SELECT v.*, u.full_name AS created_by_name FROM quotation_versions v
         LEFT JOIN admin_users u ON u.id = v.created_by
        WHERE v.id = $1 AND v.quotation_id = $2`, [req.params.versionId, req.params.id]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Quotation version not found');
    res.json({
        data: {
            id: row.id,
            versionNumber: row.version_number,
            status: row.status,
            currency: row.currency,
            subtotal: row.subtotal,
            discountAmount: row.discount_amount,
            taxAmount: row.tax_amount,
            total: row.total,
            snapshot: row.snapshot,
            createdByName: row.created_by_name,
            createdAt: row.created_at,
        },
    });
}));
function validateTravelDates(start, end) {
    if (start && end && end < start)
        throw unprocessable('The return date cannot be before the departure date.');
}
