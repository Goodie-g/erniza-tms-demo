import { adjustmentCreateSchema, paymentCreateSchema } from '@erniza/shared';
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/errors.js';
import { computePaymentTotals, decimal, roundMoney } from '../../lib/money.js';
import { escapeLike, paginationMeta, parsePagination, queryDate, queryString } from '../../lib/pagination.js';
import { nextReference } from '../../lib/reference.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { renderReceiptPdf } from '../../services/pdf.js';
export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);
paymentsRouter.get('/', asyncHandler(async (req, res) => {
    const { page, pageSize, offset, q } = parsePagination(req);
    const bookingId = queryString(req, 'bookingId');
    const method = queryString(req, 'method');
    const type = queryString(req, 'type');
    const from = queryDate(req, 'from');
    const to = queryDate(req, 'to');
    const params = [];
    const conditions = [];
    if (bookingId) {
        params.push(bookingId);
        conditions.push(`pay.booking_id = $${params.length}`);
    }
    if (method) {
        params.push(method);
        conditions.push(`pay.method = $${params.length}`);
    }
    if (type) {
        params.push(type);
        conditions.push(`pay.type = $${params.length}`);
    }
    if (from) {
        params.push(from);
        conditions.push(`pay.paid_at >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        conditions.push(`pay.paid_at <= $${params.length}::date`);
    }
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(pay.reference ILIKE $${params.length} OR pay.receipt_number ILIKE $${params.length} OR b.reference ILIKE $${params.length} OR c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR pay.external_reference ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const [count, rows] = await Promise.all([
        db.query(`SELECT count(*)::int AS total FROM payments pay JOIN bookings b ON b.id = pay.booking_id JOIN customers c ON c.id = pay.customer_id ${where}`, params),
        db.query(`SELECT pay.*, b.reference AS booking_reference, c.first_name, c.last_name,
                u.full_name AS recorded_by_name
           FROM payments pay
           JOIN bookings b ON b.id = pay.booking_id
           JOIN customers c ON c.id = pay.customer_id
           LEFT JOIN admin_users u ON u.id = pay.recorded_by
           ${where}
          ORDER BY pay.paid_at DESC, pay.created_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]),
    ]);
    res.json({
        data: rows.rows.map((row) => ({
            id: row.id,
            reference: row.reference,
            receiptNumber: row.receipt_number,
            bookingId: row.booking_id,
            bookingReference: row.booking_reference,
            customerName: `${row.first_name} ${row.last_name}`,
            type: row.type,
            method: row.method,
            amount: row.amount,
            currency: row.currency,
            paidAt: row.paid_at,
            externalReference: row.external_reference,
            notes: row.notes,
            recordedByName: row.recorded_by_name,
            createdAt: row.created_at,
        })),
        meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0),
    });
}));
paymentsRouter.post('/', validate(paymentCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    const paymentId = await db.transaction(async (tx) => {
        const bookingResult = await tx.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [
            input.bookingId,
        ]);
        const booking = bookingResult.rows[0];
        if (!booking)
            throw notFound('Booking not found');
        if (booking.status === 'cancelled' && input.type === 'payment') {
            throw conflict('Payments cannot be added to a cancelled booking. Record a refund or adjustment instead.');
        }
        const existing = await tx.query('SELECT type, amount FROM payments WHERE booking_id = $1', [input.bookingId]);
        const adjustments = await tx.query('SELECT amount FROM payment_adjustments WHERE booking_id = $1', [input.bookingId]);
        const totals = computePaymentTotals(booking.total_amount, existing.rows, adjustments.rows);
        const amount = decimal(input.amount);
        if (input.type === 'refund') {
            if (amount.gt(totals.paid))
                throw badRequest('A refund cannot exceed the amount paid to date.');
        }
        else if (amount.gt(totals.balance)) {
            throw badRequest(`The payment exceeds the outstanding balance of ${totals.balance} ${booking.currency}.`);
        }
        const reference = await nextReference(tx, 'PAY');
        const receiptNumber = await nextReference(tx, 'RCP');
        const result = await tx.query(`INSERT INTO payments (reference, receipt_number, booking_id, customer_id, type, method, amount, currency, paid_at, external_reference, notes, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [
            reference,
            receiptNumber,
            booking.id,
            booking.customer_id,
            input.type,
            input.method,
            roundMoney(input.amount),
            booking.currency,
            input.paidAt,
            input.externalReference ?? null,
            input.notes ?? null,
            actor.id,
        ]);
        const createdId = result.rows[0].id;
        await logAudit(tx, {
            actor,
            action: input.type === 'refund' ? 'payment.refund_recorded' : 'payment.recorded',
            entityType: 'payment',
            entityId: createdId,
            changes: {
                booking: booking.reference,
                amount: roundMoney(input.amount),
                currency: booking.currency,
                method: input.method,
                type: input.type,
            },
            ...requestAuditContext(req),
        });
        return { id: createdId, reference, receiptNumber };
    });
    res.status(201).json({ data: { ...paymentId, receiptUrl: `/api/v1/payments/${paymentId.id}/receipt` } });
}));
paymentsRouter.post('/adjustments', validate(adjustmentCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    const adjustmentId = await db.transaction(async (tx) => {
        const bookingResult = await tx.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [
            input.bookingId,
        ]);
        const booking = bookingResult.rows[0];
        if (!booking)
            throw notFound('Booking not found');
        if (input.paymentId) {
            const payment = await tx.query('SELECT id FROM payments WHERE id = $1 AND booking_id = $2', [
                input.paymentId,
                input.bookingId,
            ]);
            if (!payment.rows[0])
                throw notFound('Payment not found for this booking');
        }
        const existing = await tx.query('SELECT type, amount FROM payments WHERE booking_id = $1', [input.bookingId]);
        const adjustments = await tx.query('SELECT amount FROM payment_adjustments WHERE booking_id = $1', [input.bookingId]);
        const totals = computePaymentTotals(booking.total_amount, existing.rows, adjustments.rows);
        const resultingPaid = decimal(totals.paid).plus(input.amount);
        if (resultingPaid.lt(0))
            throw badRequest('This adjustment would make the amount paid negative.');
        const result = await tx.query(`INSERT INTO payment_adjustments (booking_id, payment_id, kind, amount, currency, reason, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [
            input.bookingId,
            input.paymentId ?? null,
            input.kind,
            roundMoney(input.amount),
            booking.currency,
            input.reason,
            actor.id,
        ]);
        await logAudit(tx, {
            actor,
            action: 'payment.adjustment_recorded',
            entityType: 'payment_adjustment',
            entityId: result.rows[0].id,
            changes: { booking: booking.reference, amount: roundMoney(input.amount), kind: input.kind, reason: input.reason },
            ...requestAuditContext(req),
        });
        return result.rows[0].id;
    });
    res.status(201).json({ data: { id: adjustmentId } });
}));
paymentsRouter.get('/:id/receipt', asyncHandler(async (req, res) => {
    await renderReceiptPdf(req.params.id, res);
}));
