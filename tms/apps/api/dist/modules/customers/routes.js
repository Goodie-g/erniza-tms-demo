import { customerCreateSchema, customerUpdateSchema, interactionCreateSchema } from '@erniza/shared';
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, conflict, notFound, unprocessable } from '../../lib/errors.js';
import { escapeLike, paginationMeta, parsePagination, queryString } from '../../lib/pagination.js';
import { nextReference } from '../../lib/reference.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
export const customersRouter = Router();
customersRouter.use(requireAuth);
export function normalizePhone(value) {
    return (value ?? '').replace(/\D/g, '');
}
customersRouter.get('/', asyncHandler(async (req, res) => {
    const { page, pageSize, offset, q } = parsePagination(req);
    const includesArchived = queryString(req, 'includeArchived') === 'true';
    const params = [];
    const conditions = [];
    if (!includesArchived)
        conditions.push('c.archived_at IS NULL');
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.reference ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const count = await db.query(`SELECT count(*)::int AS total FROM customers c ${where}`, params);
    const result = await db.query(`SELECT c.*,
              (SELECT count(*)::int FROM enquiries e WHERE e.customer_id = c.id) AS enquiry_count,
              (SELECT count(*)::int FROM bookings b WHERE b.customer_id = c.id) AS booking_count,
              COALESCE((
                SELECT sum(CASE WHEN p.type = 'refund' THEN -p.amount ELSE p.amount END)
                  FROM payments p WHERE p.customer_id = c.id
              ), 0)::text AS total_paid
         FROM customers c
         ${where}
         ORDER BY c.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]);
    res.json({
        data: result.rows.map(mapCustomer),
        meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0),
    });
}));
customersRouter.get('/duplicates', asyncHandler(async (req, res) => {
    const email = queryString(req, 'email')?.toLowerCase();
    const phone = normalizePhone(queryString(req, 'phone'));
    if (!email && !phone) {
        res.json({ data: [] });
        return;
    }
    const db = getDb();
    const result = await db.query(`SELECT c.*, 
              CASE WHEN $1 <> '' AND lower(c.email) = lower($1) THEN 'email' ELSE 'phone' END AS match_reason
         FROM customers c
        WHERE c.archived_at IS NULL AND (
          ($1 <> '' AND lower(c.email) = lower($1))
          OR ($2 <> '' AND regexp_replace(COALESCE(c.phone, ''), '\\D', '', 'g') = $2)
          OR ($2 <> '' AND regexp_replace(COALESCE(c.whatsapp, ''), '\\D', '', 'g') = $2)
        )
        LIMIT 10`, [email ?? '', phone]);
    res.json({ data: result.rows.map((row) => ({ ...mapCustomer(row), matchReason: row.match_reason })) });
}));
customersRouter.post('/', validate(customerCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    const customer = await db.transaction(async (tx) => {
        const reference = await nextReference(tx, 'CUS');
        const result = await tx.query(`INSERT INTO customers (reference, first_name, last_name, email, phone, whatsapp, country, preferred_channel, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`, [
            reference,
            input.firstName,
            input.lastName,
            input.email ?? null,
            input.phone ?? null,
            input.whatsapp ?? null,
            input.country ?? null,
            input.preferredChannel,
            input.notes ?? null,
        ]);
        const id = result.rows[0].id;
        await logAudit(tx, {
            actor,
            action: 'customer.created',
            entityType: 'customer',
            entityId: id,
            changes: { reference, name: `${input.firstName} ${input.lastName}`, email: input.email ?? null },
            ...requestAuditContext(req),
        });
        return { id, reference };
    });
    res.status(201).json({ data: { id: customer.id, reference: customer.reference } });
}));
customersRouter.get('/:id', asyncHandler(async (req, res) => {
    const db = getDb();
    const customerResult = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    const row = customerResult.rows[0];
    if (!row)
        throw notFound('Customer not found');
    const [interactions, enquiries, quotations, bookings, payments] = await Promise.all([
        db.query(`SELECT i.*, u.full_name AS author_name
           FROM customer_interactions i
           LEFT JOIN admin_users u ON u.id = i.created_by
          WHERE i.customer_id = $1
          ORDER BY i.occurred_at DESC
          LIMIT 100`, [req.params.id]),
        db.query(`SELECT e.*, p.name AS product_name
           FROM enquiries e LEFT JOIN products p ON p.id = e.product_id
          WHERE e.customer_id = $1 ORDER BY e.created_at DESC`, [req.params.id]),
        db.query(`SELECT q.*, e.reference AS enquiry_reference
           FROM quotations q LEFT JOIN enquiries e ON e.id = q.enquiry_id
          WHERE q.customer_id = $1 ORDER BY q.created_at DESC`, [req.params.id]),
        db.query(`SELECT b.*, q.reference AS quotation_reference, p.name AS product_name,
                COALESCE((SELECT sum(CASE WHEN pay.type='refund' THEN -pay.amount ELSE pay.amount END)
                            FROM payments pay WHERE pay.booking_id = b.id), 0)
                + COALESCE((SELECT sum(adj.amount) FROM payment_adjustments adj WHERE adj.booking_id = b.id), 0)
                AS amount_paid
           FROM bookings b
           JOIN quotations q ON q.id = b.quotation_id
           LEFT JOIN products p ON p.id = b.product_id
          WHERE b.customer_id = $1 ORDER BY b.travel_date_start DESC`, [req.params.id]),
        db.query(`SELECT pay.*, b.reference AS booking_reference, u.full_name AS recorded_by_name
           FROM payments pay
           JOIN bookings b ON b.id = pay.booking_id
           LEFT JOIN admin_users u ON u.id = pay.recorded_by
          WHERE pay.customer_id = $1 ORDER BY pay.paid_at DESC, pay.created_at DESC`, [req.params.id]),
    ]);
    res.json({
        data: {
            ...mapCustomer(row),
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
            enquiries: enquiries.rows.map((item) => ({
                ...item,
                customerName: `${row.first_name} ${row.last_name}`,
                travelDateStart: item.travel_date_start,
                travelDateEnd: item.travel_date_end,
                budgetAmount: item.budget_amount,
                budgetCurrency: item.budget_currency,
                followUpDate: item.follow_up_date,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
            })),
            quotations: quotations.rows.map((item) => ({
                ...item,
                customerName: `${row.first_name} ${row.last_name}`,
                currentVersion: item.current_version,
                travelDateStart: item.travel_date_start,
                travelDateEnd: item.travel_date_end,
                validityUntil: item.validity_until,
                issuedAt: item.issued_at,
                createdAt: item.created_at,
            })),
            bookings: bookings.rows.map((item) => ({
                ...item,
                customerName: `${row.first_name} ${row.last_name}`,
                quotationReference: item.quotation_reference,
                productName: item.product_name,
                travelDateStart: item.travel_date_start,
                travelDateEnd: item.travel_date_end,
                totalAmount: item.total_amount,
                amountPaid: Number(item.amount_paid ?? 0).toFixed(2),
                balance: (Number(item.total_amount) - Number(item.amount_paid ?? 0)).toFixed(2),
                createdAt: item.created_at,
            })),
            payments: payments.rows.map((item) => ({
                id: item.id,
                reference: item.reference,
                receiptNumber: item.receipt_number,
                bookingId: item.booking_id,
                bookingReference: item.booking_reference,
                type: item.type,
                method: item.method,
                amount: item.amount,
                currency: item.currency,
                paidAt: item.paid_at,
                externalReference: item.external_reference,
                notes: item.notes,
                recordedByName: item.recorded_by_name,
                createdAt: item.created_at,
            })),
        },
    });
}));
customersRouter.patch('/:id', validate(customerUpdateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const fields = [];
    const values = [];
    const map = {
        firstName: 'first_name',
        lastName: 'last_name',
        email: 'email',
        phone: 'phone',
        whatsapp: 'whatsapp',
        country: 'country',
        preferredChannel: 'preferred_channel',
        notes: 'notes',
    };
    for (const [key, column] of Object.entries(map)) {
        if (key in input) {
            values.push(input[key] ?? null);
            fields.push(`${column} = $${values.length}`);
        }
    }
    if (!fields.length)
        throw unprocessable('No changes supplied');
    values.push(req.params.id);
    const db = getDb();
    await db.transaction(async (tx) => {
        const result = await tx.query(`UPDATE customers SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING id`, values);
        if (!result.rows[0])
            throw notFound('Customer not found');
        await logAudit(tx, {
            actor,
            action: 'customer.updated',
            entityType: 'customer',
            entityId: req.params.id,
            changes: input,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: { success: true } });
}));
customersRouter.post('/:id/interactions', validate(interactionCreateSchema.omit({ customerId: true })), asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const input = req.body;
    const db = getDb();
    const result = await db.transaction(async (tx) => {
        const exists = await tx.query('SELECT id FROM customers WHERE id = $1', [req.params.id]);
        if (!exists.rows[0])
            throw conflict('Customer not found');
        const insert = await tx.query(`INSERT INTO customer_interactions (customer_id, enquiry_id, type, summary, occurred_at, created_by)
         VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, now()),$6) RETURNING id`, [req.params.id, input.enquiryId ?? null, input.type, input.summary, input.occurredAt ?? null, actor.id]);
        await logAudit(tx, {
            actor,
            action: 'customer.interaction_recorded',
            entityType: 'customer',
            entityId: req.params.id,
            changes: { type: input.type, summary: input.summary },
            ...requestAuditContext(req),
        });
        return insert.rows[0].id;
    });
    res.status(201).json({ data: { id: result } });
}));
function mapCustomer(row) {
    return {
        id: row.id,
        reference: row.reference,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        whatsapp: row.whatsapp,
        country: row.country,
        preferredChannel: row.preferred_channel,
        notes: row.notes,
        archivedAt: row.archived_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        enquiryCount: row.enquiry_count,
        bookingCount: row.booking_count,
        totalPaid: row.total_paid ? Number(row.total_paid).toFixed(2) : undefined,
    };
}
