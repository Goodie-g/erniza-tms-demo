import { invoiceCreateSchema, invoiceUpdateSchema } from '@erniza/shared';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/errors.js';
import { escapeLike, paginationMeta, parsePagination, queryDate, queryString } from '../../lib/pagination.js';
import { requireAuth } from '../../middleware/auth.js';
import { providedKeys, validate } from '../../middleware/validate.js';
import { nextReference } from '../../lib/reference.js';
import { decimal, roundMoney } from '../../lib/money.js';
import { computeInvoiceTotals, loadInvoice } from './service.js';
import { renderInvoicePdf, renderInvoicePdfToBuffer } from '../../services/pdf.js';
import { getSettings } from '../../services/settings.js';
import { sendEmail } from '../../services/email.js';
export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);
invoicesRouter.get('/', asyncHandler(async (req, res) => {
    const { page, pageSize, offset, q } = parsePagination(req);
    const status = queryString(req, 'status');
    const customerId = queryString(req, 'customerId');
    const bookingId = queryString(req, 'bookingId');
    const from = queryDate(req, 'from');
    const to = queryDate(req, 'to');
    const params = [];
    const conditions = [];
    if (status) {
        params.push(status);
        conditions.push(`i.status = $${params.length}`);
    }
    if (customerId) {
        params.push(customerId);
        conditions.push(`i.customer_id = $${params.length}`);
    }
    if (bookingId) {
        params.push(bookingId);
        conditions.push(`i.booking_id = $${params.length}`);
    }
    if (from) {
        params.push(from);
        conditions.push(`i.issue_date >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        conditions.push(`i.issue_date <= $${params.length}::date`);
    }
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(i.reference ILIKE $${params.length} OR c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR b.reference ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const [count, rows] = await Promise.all([
        db.query(`SELECT count(*)::int AS total FROM invoices i JOIN customers c ON c.id = i.customer_id LEFT JOIN bookings b ON b.id = i.booking_id ${where}`, params),
        db.query(`SELECT i.*, c.first_name, c.last_name, b.reference AS booking_reference
           FROM invoices i
           JOIN customers c ON c.id = i.customer_id
           LEFT JOIN bookings b ON b.id = i.booking_id
           ${where}
          ORDER BY i.created_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]),
    ]);
    res.json({
        data: rows.rows.map((row) => ({
            id: row.id,
            reference: row.reference,
            bookingId: row.booking_id,
            bookingReference: row.booking_reference,
            customerId: row.customer_id,
            customerName: `${row.first_name} ${row.last_name}`,
            status: row.status,
            currency: row.currency,
            total: row.total,
            amountPaid: row.amount_paid,
            balance: row.balance,
            issueDate: row.issue_date,
            dueDate: row.due_date,
            createdAt: row.created_at,
        })),
        meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0),
    });
}));
invoicesRouter.post('/', validate(invoiceCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    if (!input.bookingId && !input.customerId) {
        throw badRequest('An invoice must be linked to a booking or a customer.');
    }
    const db = getDb();
    const invoiceId = await db.transaction(async (tx) => {
        let booking = null;
        if (input.bookingId) {
            const bookingResult = await tx.query('SELECT * FROM bookings WHERE id = $1', [input.bookingId]);
            booking = bookingResult.rows[0] ?? null;
            if (!booking)
                throw notFound('Booking not found');
        }
        const customerId = input.customerId ?? booking?.customer_id;
        if (!customerId)
            throw badRequest('A customer is required for this invoice.');
        const customerResult = await tx.query('SELECT * FROM customers WHERE id = $1', [customerId]);
        const customer = customerResult.rows[0];
        if (!customer)
            throw notFound('Customer not found');
        const currency = booking?.currency ?? 'USD';
        const items = input.items.length > 0
            ? input.items
            : booking
                ? [
                    {
                        description: `Safari services${booking.product_id ? '' : ''}`,
                        quantity: '1',
                        unitPrice: booking.total_amount,
                    },
                ]
                : [];
        const totals = computeInvoiceTotals(items, 0);
        // If booking exists, use booking total as authoritative default when no items provided.
        const finalTotals = input.items.length === 0 && booking
            ? { subtotal: roundMoney(booking.total_amount), taxAmount: '0.00', total: roundMoney(booking.total_amount) }
            : totals;
        const reference = await nextReference(tx, 'INV');
        const result = await tx.query(`INSERT INTO invoices (reference, booking_id, customer_id, status, currency, subtotal, tax_rate, tax_amount, total, balance, issue_date, due_date, payment_terms, notes, created_by, updated_by)
         VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$13) RETURNING id`, [
            reference,
            booking?.id ?? null,
            customerId,
            currency,
            finalTotals.subtotal,
            '0',
            finalTotals.taxAmount,
            finalTotals.total,
            input.issueDate ?? new Date().toISOString().slice(0, 10),
            input.dueDate ?? null,
            input.paymentTerms ?? null,
            input.notes ?? null,
            actor.id,
        ]);
        const createdId = result.rows[0].id;
        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            const quantity = String(item.quantity ?? '1');
            const unitPrice = String(item.unitPrice ?? '0');
            const totalPrice = roundMoney(decimal(quantity).times(decimal(unitPrice)));
            await tx.query(`INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`, [createdId, item.description, quantity, unitPrice, totalPrice, index]);
        }
        const snapshot = {
            booking: booking
                ? { reference: booking.reference, totalAmount: booking.total_amount, currency: booking.currency }
                : null,
            customer: { id: customer.id, name: `${customer.first_name} ${customer.last_name}`, email: customer.email },
        };
        await tx.query('UPDATE invoices SET snapshot = $1 WHERE id = $2', [JSON.stringify(snapshot), createdId]);
        await logAudit(tx, {
            actor,
            action: 'invoice.created',
            entityType: 'invoice',
            entityId: createdId,
            changes: { reference, booking: booking?.reference ?? null, total: finalTotals.total, currency },
            ...requestAuditContext(req),
        });
        return createdId;
    });
    res.status(201).json({ data: await loadInvoice(invoiceId) });
}));
invoicesRouter.get('/:id', asyncHandler(async (req, res) => {
    res.json({ data: await loadInvoice(req.params.id) });
}));
invoicesRouter.patch('/:id', validate(invoiceUpdateSchema), asyncHandler(async (req, res) => {
    const allInput = req.body;
    const keys = new Set(providedKeys(req) ?? Object.keys(allInput));
    const input = Object.fromEntries(Object.entries(allInput).filter(([key]) => keys.has(key)));
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [req.params.id]);
        const current = existing.rows[0];
        if (!current)
            throw notFound('Invoice not found');
        if (!['draft'].includes(current.status)) {
            throw conflict('Only draft invoices can be edited. Issue a new invoice or record an adjustment instead.');
        }
        if (input.items) {
            await tx.query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
            const totals = computeInvoiceTotals(input.items, 0);
            for (let index = 0; index < input.items.length; index += 1) {
                const item = input.items[index];
                const quantity = String(item.quantity ?? '1');
                const unitPrice = String(item.unitPrice ?? '0');
                await tx.query(`INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6)`, [req.params.id, item.description, quantity, unitPrice, roundMoney(decimal(quantity).times(decimal(unitPrice))), index]);
            }
            await tx.query(`UPDATE invoices SET subtotal = $1, tax_amount = $2, total = $3, balance = $3, updated_at = now() WHERE id = $4`, [totals.subtotal, totals.taxAmount, totals.total, req.params.id]);
        }
        const fields = [];
        const values = [];
        const map = {
            issueDate: 'issue_date',
            dueDate: 'due_date',
            paymentTerms: 'payment_terms',
            notes: 'notes',
        };
        for (const [key, column] of Object.entries(map)) {
            if (key in input) {
                values.push(input[key] ?? null);
                fields.push(`${column} = $${values.length}`);
            }
        }
        if (fields.length) {
            values.push(actor.id, req.params.id);
            await tx.query(`UPDATE invoices SET ${fields.join(', ')}, updated_by = $${values.length - 1}, updated_at = now() WHERE id = $${values.length}`, values);
        }
        await logAudit(tx, {
            actor,
            action: 'invoice.updated',
            entityType: 'invoice',
            entityId: req.params.id,
            changes: input,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadInvoice(req.params.id) });
}));
invoicesRouter.post('/:id/issue', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [req.params.id]);
        const invoice = existing.rows[0];
        if (!invoice)
            throw notFound('Invoice not found');
        if (invoice.status !== 'draft')
            throw conflict('Only draft invoices can be issued.');
        const items = await tx.query('SELECT count(*)::int AS count FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
        if ((items.rows[0]?.count ?? 0) === 0)
            throw badRequest('Add at least one line item before issuing.');
        await tx.query(`UPDATE invoices SET status = 'issued', issued_at = now(), updated_by = $1, updated_at = now() WHERE id = $2`, [actor.id, req.params.id]);
        await logAudit(tx, {
            actor,
            action: 'invoice.issued',
            entityType: 'invoice',
            entityId: req.params.id,
            changes: { from: 'draft', to: 'issued' },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadInvoice(req.params.id) });
}));
invoicesRouter.post('/:id/send', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const invoice = await loadInvoice(req.params.id);
    if (invoice.status !== 'issued')
        throw conflict('Only issued invoices can be sent.');
    if (!invoice.customerEmail)
        throw badRequest('The customer does not have an email address on file.');
    const settings = await getSettings();
    const pdfBuffer = await renderInvoicePdfToBuffer(req.params.id);
    await sendEmail({
        to: invoice.customerEmail,
        subject: `Invoice ${invoice.reference} from ${settings.company.name}`,
        text: `Dear ${invoice.customerName},\n\nPlease find attached invoice ${invoice.reference} for ${invoice.total} ${invoice.currency}.\n\nPayment is due by ${invoice.dueDate ?? 'the date agreed'}. Bank details are included in the attached PDF.\n\nThank you,\n${settings.company.name}`,
        html: `<p>Dear ${escapeHtml(invoice.customerName)},</p><p>Please find attached invoice <strong>${invoice.reference}</strong> for <strong>${escapeHtml(invoice.total)} ${invoice.currency}</strong>.</p><p>Payment is due by ${invoice.dueDate ?? 'the date agreed'}. Bank details are included in the attached PDF.</p><p>Thank you,<br>${escapeHtml(settings.company.name)}</p>`,
        attachments: [{ filename: `${invoice.reference}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    });
    const db = getDb();
    await db.transaction(async (tx) => {
        await tx.query("UPDATE invoices SET status = 'sent', sent_at = now(), updated_by = $1, updated_at = now() WHERE id = $2", [actor.id, req.params.id]);
        await logAudit(tx, {
            actor,
            action: 'invoice.sent',
            entityType: 'invoice',
            entityId: req.params.id,
            changes: { to: invoice.customerEmail },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadInvoice(req.params.id) });
}));
invoicesRouter.post('/:id/cancel', validate(z.object({ reason: z.string().trim().min(3).max(2000) })), asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [req.params.id]);
        const invoice = existing.rows[0];
        if (!invoice)
            throw notFound('Invoice not found');
        if (['paid', 'cancelled'].includes(invoice.status))
            throw conflict('This invoice cannot be cancelled.');
        await tx.query(`UPDATE invoices SET status = 'cancelled', cancelled_at = now(), cancellation_reason = $1, updated_by = $2, updated_at = now() WHERE id = $3`, [reason, actor.id, req.params.id]);
        await logAudit(tx, {
            actor,
            action: 'invoice.cancelled',
            entityType: 'invoice',
            entityId: req.params.id,
            changes: { reason },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadInvoice(req.params.id) });
}));
invoicesRouter.get('/:id/pdf', asyncHandler(async (req, res) => {
    await renderInvoicePdf(req.params.id, res);
}));
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[character];
    });
}
