import { bookingUpdateSchema, travellerCreateSchema } from '@erniza/shared';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, badRequest, conflict, notFound, unprocessable } from '../../lib/errors.js';
import { escapeLike, paginationMeta, parsePagination, queryDate, queryString } from '../../lib/pagination.js';
import { requireAuth } from '../../middleware/auth.js';
import { providedKeys, validate } from '../../middleware/validate.js';
import { loadBooking } from './service.js';
export const bookingsRouter = Router();
bookingsRouter.use(requireAuth);
const TRANSITIONS = {
    pending_confirmation: ['confirmed', 'cancelled'],
    confirmed: ['in_progress', 'completed', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
};
bookingsRouter.get('/', asyncHandler(async (req, res) => {
    const { page, pageSize, offset, q } = parsePagination(req);
    const status = queryString(req, 'status');
    const from = queryDate(req, 'from');
    const to = queryDate(req, 'to');
    const paymentStatus = queryString(req, 'paymentStatus');
    const params = [];
    const conditions = [];
    if (status) {
        params.push(status.split(',').filter(Boolean));
        conditions.push(`b.status = ANY($${params.length})`);
    }
    if (from) {
        params.push(from);
        conditions.push(`b.travel_date_start >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        conditions.push(`b.travel_date_start <= $${params.length}::date`);
    }
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(b.reference ILIKE $${params.length} OR c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR q.reference ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const base = `FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN quotations q ON q.id = b.quotation_id ${where}`;
    const [count, rows] = await Promise.all([
        db.query(`SELECT count(*)::int AS total ${base}`, params),
        db.query(`SELECT b.*, c.first_name, c.last_name, c.email AS customer_email, q.reference AS quotation_reference,
                p.name AS product_name,
                COALESCE((SELECT sum(CASE WHEN pay.type = 'refund' THEN -pay.amount ELSE pay.amount END)
                            FROM payments pay WHERE pay.booking_id = b.id), 0)
                + COALESCE((SELECT sum(adj.amount) FROM payment_adjustments adj WHERE adj.booking_id = b.id), 0) AS amount_paid
           ${base.replace('FROM bookings b', 'FROM bookings b LEFT JOIN products p ON p.id = b.product_id')}
          ORDER BY b.travel_date_start DESC, b.created_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]),
    ]);
    const data = rows.rows
        .map((row) => {
        const paid = Number(row.amount_paid ?? 0);
        const total = Number(row.total_amount);
        const balance = total - paid;
        let paymentStatusValue = 'unpaid';
        if (paid > total)
            paymentStatusValue = 'overpaid';
        else if (paid === total && total > 0)
            paymentStatusValue = 'paid';
        else if (paid > 0)
            paymentStatusValue = balance < total * 0.5 ? 'partial' : 'deposit';
        return {
            id: row.id,
            reference: row.reference,
            customerId: row.customer_id,
            customerName: `${row.first_name} ${row.last_name}`,
            customerEmail: row.customer_email,
            productId: row.product_id,
            productName: row.product_name,
            quotationId: row.quotation_id,
            quotationReference: row.quotation_reference,
            status: row.status,
            travelDateStart: row.travel_date_start,
            travelDateEnd: row.travel_date_end,
            adults: row.adults,
            children: row.children,
            currency: row.currency,
            totalAmount: row.total_amount,
            amountPaid: paid.toFixed(2),
            balance: balance.toFixed(2),
            paymentStatus: paymentStatusValue,
            createdAt: row.created_at,
        };
    });
    res.json({ data, meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0) });
}));
bookingsRouter.get('/:id', asyncHandler(async (req, res) => {
    res.json({ data: await loadBooking(req.params.id) });
}));
bookingsRouter.patch('/:id', validate(bookingUpdateSchema), asyncHandler(async (req, res) => {
    const allInput = req.body;
    const keys = new Set(providedKeys(req) ?? Object.keys(allInput));
    const input = Object.fromEntries(Object.entries(allInput).filter(([key]) => keys.has(key)));
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [
            req.params.id,
        ]);
        const current = existing.rows[0];
        if (!current)
            throw notFound('Booking not found');
        if (input.status && input.status !== current.status) {
            const allowed = TRANSITIONS[current.status] ?? [];
            if (!allowed.includes(input.status)) {
                throw conflict(`A booking cannot move from ${current.status.replace(/_/g, ' ')} to ${input.status.replace(/_/g, ' ')}.`);
            }
            if (input.status === 'cancelled' && !(input.cancellationReason ?? current.cancellation_reason)) {
                throw badRequest('A cancellation reason is required.');
            }
        }
        const start = input.travelDateStart ?? current.travel_date_start;
        const end = input.travelDateEnd ?? current.travel_date_end;
        if (start && end && end < start)
            throw unprocessable('The return date cannot be before the departure date.');
        if (['completed', 'cancelled'].includes(current.status) && (input.travelDateStart || input.travelDateEnd)) {
            throw conflict('Travel dates cannot be changed on a completed or cancelled booking.');
        }
        const map = {
            travelDateStart: 'travel_date_start',
            travelDateEnd: 'travel_date_end',
            accommodation: 'accommodation',
            itinerary: 'itinerary',
            specialRequirements: 'special_requirements',
            operationalNotes: 'operational_notes',
            guideName: 'guide_name',
            driverName: 'driver_name',
            vehicle: 'vehicle',
            cancellationReason: 'cancellation_reason',
        };
        const fields = [];
        const values = [];
        for (const [key, column] of Object.entries(map)) {
            if (key in input) {
                values.push(input[key] ?? null);
                fields.push(`${column} = $${values.length}`);
            }
        }
        if (input.status) {
            values.push(input.status);
            fields.push(`status = $${values.length}`);
            if (input.status === 'confirmed') {
                values.push(current.confirmed_at ?? new Date());
                fields.push(`confirmed_at = $${values.length}`);
            }
            if (input.status === 'completed') {
                values.push(new Date());
                fields.push(`completed_at = $${values.length}`);
            }
            if (input.status === 'cancelled') {
                values.push(new Date());
                fields.push(`cancelled_at = $${values.length}`);
            }
        }
        if (fields.length) {
            values.push(actor.id, req.params.id);
            await tx.query(`UPDATE bookings SET ${fields.join(', ')}, updated_by = $${values.length - 1}, updated_at = now() WHERE id = $${values.length}`, values);
        }
        if (input.status === 'cancelled') {
            await tx.query("UPDATE tours SET status = 'cancelled', updated_at = now() WHERE booking_id = $1", [req.params.id]);
        }
        await logAudit(tx, {
            actor,
            action: input.status && input.status !== current.status ? 'booking.status_changed' : 'booking.updated',
            entityType: 'booking',
            entityId: req.params.id,
            changes: input.status && input.status !== current.status
                ? { from: current.status, to: input.status }
                : input,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadBooking(req.params.id) });
}));
bookingsRouter.post('/:id/cancel', validate(z.object({ reason: z.string().trim().min(3).max(2000) })), asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [
            req.params.id,
        ]);
        const booking = existing.rows[0];
        if (!booking)
            throw notFound('Booking not found');
        if (['completed', 'cancelled'].includes(booking.status)) {
            throw conflict('This booking is already completed or cancelled.');
        }
        await tx.query(`UPDATE bookings SET status = 'cancelled', cancellation_reason = $1, cancelled_at = now(), updated_by = $2, updated_at = now()
         WHERE id = $3`, [reason, actor.id, req.params.id]);
        await tx.query("UPDATE tours SET status = 'cancelled', updated_at = now() WHERE booking_id = $1", [req.params.id]);
        await logAudit(tx, {
            actor,
            action: 'booking.cancelled',
            entityType: 'booking',
            entityId: req.params.id,
            changes: { reason },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadBooking(req.params.id) });
}));
bookingsRouter.post('/:id/travellers', validate(travellerCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const booking = await tx.query('SELECT id FROM bookings WHERE id = $1', [req.params.id]);
        if (!booking.rows[0])
            throw notFound('Booking not found');
        const count = await tx.query('SELECT count(*)::int AS count FROM booking_travellers WHERE booking_id = $1', [req.params.id]);
        const isLead = input.isLead || (count.rows[0]?.count ?? 0) === 0;
        if (isLead) {
            await tx.query('UPDATE booking_travellers SET is_lead = false WHERE booking_id = $1', [req.params.id]);
        }
        const result = await tx.query(`INSERT INTO booking_travellers (booking_id, first_name, last_name, email, phone, date_of_birth, passport_number, nationality, is_lead)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [
            req.params.id,
            input.firstName,
            input.lastName,
            input.email ?? null,
            input.phone ?? null,
            input.dateOfBirth ?? null,
            input.passportNumber ?? null,
            input.nationality ?? null,
            isLead,
        ]);
        await logAudit(tx, {
            actor,
            action: 'booking.traveller_added',
            entityType: 'booking',
            entityId: req.params.id,
            changes: { travellerId: result.rows[0].id, name: `${input.firstName} ${input.lastName}` },
            ...requestAuditContext(req),
        });
    });
    res.status(201).json({ data: await loadBooking(req.params.id) });
}));
bookingsRouter.patch('/:id/travellers/:travellerId', validate(travellerCreateSchema.partial()), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT id FROM booking_travellers WHERE id = $1 AND booking_id = $2', [
            req.params.travellerId,
            req.params.id,
        ]);
        if (!existing.rows[0])
            throw notFound('Traveller not found');
        if (input.isLead) {
            await tx.query('UPDATE booking_travellers SET is_lead = false WHERE booking_id = $1', [req.params.id]);
        }
        const map = {
            firstName: 'first_name',
            lastName: 'last_name',
            email: 'email',
            phone: 'phone',
            dateOfBirth: 'date_of_birth',
            passportNumber: 'passport_number',
            nationality: 'nationality',
            isLead: 'is_lead',
        };
        const fields = [];
        const values = [];
        for (const [key, column] of Object.entries(map)) {
            if (key in input) {
                values.push(input[key] ?? null);
                fields.push(`${column} = $${values.length}`);
            }
        }
        if (!fields.length)
            return;
        values.push(req.params.travellerId);
        await tx.query(`UPDATE booking_travellers SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
        await logAudit(tx, {
            actor,
            action: 'booking.traveller_updated',
            entityType: 'booking',
            entityId: req.params.id,
            changes: { travellerId: req.params.travellerId, fields: Object.keys(input) },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadBooking(req.params.id) });
}));
bookingsRouter.delete('/:id/travellers/:travellerId', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const result = await tx.query('DELETE FROM booking_travellers WHERE id = $1 AND booking_id = $2 RETURNING id', [
            req.params.travellerId,
            req.params.id,
        ]);
        if (!result.rows[0])
            throw notFound('Traveller not found');
        await logAudit(tx, {
            actor,
            action: 'booking.traveller_removed',
            entityType: 'booking',
            entityId: req.params.id,
            changes: { travellerId: req.params.travellerId },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadBooking(req.params.id) });
}));
