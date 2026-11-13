import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { asyncHandler, badRequest } from '../../lib/errors.js';
import { escapeLike, queryDate, queryString, toCsv } from '../../lib/pagination.js';
import { requireAuth } from '../../middleware/auth.js';
export const reportsRouter = Router();
reportsRouter.use(requireAuth);
/**
 * Reporting periods:
 *  - enquiries  -> enquiry creation date
 *  - quotations -> quotation creation date
 *  - bookings   -> travel (departure) date
 *  - payments   -> payment date
 * Outstanding balances are calculated as at the end of the period.
 */
function resolveRange(req) {
    const today = new Date();
    const year = today.getUTCFullYear();
    const from = queryDate(req, 'from') ?? new Date(Date.UTC(year, 0, 1)).toISOString().slice(0, 10);
    const to = queryDate(req, 'to') ?? new Date(Date.UTC(year, 11, 31)).toISOString().slice(0, 10);
    if (from > to)
        throw badRequest('The start date must be on or before the end date.');
    return { from, to };
}
function monthsBetween(from, to) {
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    const months = [];
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor <= end && months.length < 60) {
        months.push({
            key: cursor.toISOString().slice(0, 7),
            label: new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(cursor),
        });
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return months;
}
function ratio(part, total) {
    return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}
function sendCsv(res, fileName, content) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(`\uFEFF${content}`);
}
reportsRouter.get('/overview', asyncHandler(async (req, res) => {
    const range = resolveRange(req);
    const db = getDb();
    const dateArgs = [range.from, range.to];
    const [enquiryTotals, enquiryByStatus, enquiryBySource, enquiryMonthly, quotationTotals, quotationByCurrency, bookingTotals, bookingByStatus, bookingByCurrency, bookingMonthly, topProducts, paymentByCurrency, paymentByMethod, paymentMonthly, outstanding, adjustmentTotals, tourTotals,] = await Promise.all([
        db.query(`SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'converted')::int AS converted,
                count(*) FILTER (WHERE status = 'lost')::int AS lost,
                count(*) FILTER (WHERE status = 'new')::int AS new_count,
                COALESCE(sum(adults + children), 0)::int AS travellers
           FROM enquiries
          WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')`, dateArgs),
        db.query(`SELECT status, count(*)::int AS count FROM enquiries
          WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
          GROUP BY status ORDER BY status`, dateArgs),
        db.query(`SELECT source, count(*)::int AS count FROM enquiries
          WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
          GROUP BY source ORDER BY count DESC`, dateArgs),
        db.query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
                count(*)::int AS count,
                count(*) FILTER (WHERE status = 'converted')::int AS converted
           FROM enquiries
          WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
          GROUP BY 1 ORDER BY 1`, dateArgs),
        db.query(`SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'sent')::int AS sent,
                count(*) FILTER (WHERE status = 'accepted')::int AS accepted,
                count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
                count(*) FILTER (WHERE status = 'expired')::int AS expired
           FROM quotations
          WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')`, dateArgs),
        db.query(`SELECT currency, count(*)::int AS count, COALESCE(sum(total), 0)::text AS value
           FROM quotations
          WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
          GROUP BY currency ORDER BY currency`, dateArgs),
        db.query(`SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
                count(*) FILTER (WHERE status IN ('confirmed','in_progress','completed'))::int AS confirmed,
                count(*) FILTER (WHERE status = 'completed')::int AS completed,
                COALESCE(sum(adults + children) FILTER (WHERE status <> 'cancelled'), 0)::int AS travellers,
                COALESCE(sum(total_amount) FILTER (WHERE status <> 'cancelled'), 0)::text AS value
           FROM bookings
          WHERE travel_date_start >= $1::date AND travel_date_start <= $2::date`, dateArgs),
        db.query(`SELECT status, count(*)::int AS count FROM bookings
          WHERE travel_date_start >= $1::date AND travel_date_start <= $2::date
          GROUP BY status ORDER BY status`, dateArgs),
        db.query(`SELECT currency, count(*)::int AS count, COALESCE(sum(total_amount), 0)::text AS value
           FROM bookings
          WHERE travel_date_start >= $1::date AND travel_date_start <= $2::date AND status <> 'cancelled'
          GROUP BY currency ORDER BY currency`, dateArgs),
        db.query(`SELECT to_char(date_trunc('month', travel_date_start), 'YYYY-MM') AS month,
                count(*)::int AS count,
                COALESCE(sum(total_amount), 0)::text AS value
           FROM bookings
          WHERE travel_date_start >= $1::date AND travel_date_start <= $2::date AND status <> 'cancelled'
          GROUP BY 1 ORDER BY 1`, dateArgs),
        db.query(`SELECT COALESCE(p.name, 'Unassigned') AS product, count(*)::int AS count,
                COALESCE(sum(b.total_amount), 0)::text AS value
           FROM bookings b LEFT JOIN products p ON p.id = b.product_id
          WHERE b.travel_date_start >= $1::date AND b.travel_date_start <= $2::date AND b.status <> 'cancelled'
          GROUP BY 1 ORDER BY count DESC, value DESC LIMIT 8`, dateArgs),
        db.query(`SELECT currency,
                COALESCE(sum(amount) FILTER (WHERE type = 'payment'), 0)::text AS collected,
                COALESCE(sum(amount) FILTER (WHERE type = 'refund'), 0)::text AS refunded,
                COALESCE(sum(CASE WHEN type = 'refund' THEN -amount ELSE amount END), 0)::text AS net,
                count(*)::int AS count
           FROM payments
          WHERE paid_at >= $1::date AND paid_at <= $2::date
          GROUP BY currency ORDER BY currency`, dateArgs),
        db.query(`SELECT method, currency, count(*)::int AS count,
                COALESCE(sum(CASE WHEN type = 'refund' THEN -amount ELSE amount END), 0)::text AS amount
           FROM payments
          WHERE paid_at >= $1::date AND paid_at <= $2::date
          GROUP BY method, currency ORDER BY method, currency`, dateArgs),
        db.query(`SELECT to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month,
                COALESCE(sum(CASE WHEN type = 'refund' THEN -amount ELSE amount END), 0)::text AS net
           FROM payments
          WHERE paid_at >= $1::date AND paid_at <= $2::date
          GROUP BY 1 ORDER BY 1`, dateArgs),
        db.query(`WITH paid AS (
           SELECT b.id, b.currency, b.total_amount,
                  COALESCE((SELECT sum(CASE WHEN p.type = 'refund' THEN -p.amount ELSE p.amount END)
                              FROM payments p WHERE p.booking_id = b.id), 0)
                  + COALESCE((SELECT sum(a.amount) FROM payment_adjustments a WHERE a.booking_id = b.id), 0) AS paid
             FROM bookings b
            WHERE b.status IN ('pending_confirmation','confirmed','in_progress','completed')
              AND b.travel_date_start <= $1::date
         )
         SELECT currency, sum(total_amount)::text AS invoiced, sum(paid)::text AS paid,
                sum(total_amount - paid)::text AS outstanding
           FROM paid GROUP BY currency ORDER BY currency`, [range.to]),
        db.query(`SELECT currency, COALESCE(sum(amount), 0)::text AS amount, count(*)::int AS count
           FROM payment_adjustments
          WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
          GROUP BY currency ORDER BY currency`, dateArgs),
        db.query(`SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
                count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
                count(*) FILTER (WHERE status = 'completed')::int AS completed,
                count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
           FROM tours
          WHERE departure_date >= $1::date AND departure_date <= $2::date`, dateArgs),
    ]);
    const enquiries = enquiryTotals.rows[0] ?? { total: 0, converted: 0, lost: 0, new_count: 0, travellers: 0 };
    const bookings = bookingTotals.rows[0] ?? {
        total: 0,
        cancelled: 0,
        confirmed: 0,
        completed: 0,
        travellers: 0,
        value: '0',
    };
    const monthList = monthsBetween(range.from, range.to);
    res.json({
        data: {
            range: { ...range, basis: 'enquiries/quotations by creation, bookings by departure, payments by payment date' },
            generatedAt: new Date().toISOString(),
            enquiries: {
                total: enquiries.total,
                converted: enquiries.converted,
                lost: enquiries.lost,
                new: enquiries.new_count,
                travellers: enquiries.travellers,
                conversionRate: ratio(enquiries.converted, enquiries.total),
                lostRate: ratio(enquiries.lost, enquiries.total),
                byStatus: enquiryByStatus.rows,
                bySource: enquiryBySource.rows,
                monthly: monthList.map((month) => ({
                    month: month.label,
                    key: month.key,
                    enquiries: enquiryMonthly.rows.find((row) => row.month === month.key)?.count ?? 0,
                    converted: enquiryMonthly.rows.find((row) => row.month === month.key)?.converted ?? 0,
                })),
            },
            quotations: {
                ...(quotationTotals.rows[0] ?? { total: 0, sent: 0, accepted: 0, rejected: 0, expired: 0 }),
                acceptanceRate: ratio(quotationTotals.rows[0]?.accepted ?? 0, (quotationTotals.rows[0]?.accepted ?? 0) + (quotationTotals.rows[0]?.rejected ?? 0)),
                byCurrency: quotationByCurrency.rows,
            },
            bookings: {
                total: bookings.total,
                cancelled: bookings.cancelled,
                confirmed: bookings.confirmed,
                completed: bookings.completed,
                travellers: bookings.travellers,
                value: bookings.value,
                cancellationRate: ratio(bookings.cancelled, bookings.total),
                byStatus: bookingByStatus.rows,
                byCurrency: bookingByCurrency.rows,
                topProducts: topProducts.rows,
                monthly: monthList.map((month) => ({
                    month: month.label,
                    key: month.key,
                    bookings: bookingMonthly.rows.find((row) => row.month === month.key)?.count ?? 0,
                    value: bookingMonthly.rows.find((row) => row.month === month.key)?.value ?? '0',
                })),
            },
            finance: {
                byCurrency: paymentByCurrency.rows,
                byMethod: paymentByMethod.rows,
                adjustments: adjustmentTotals.rows,
                outstanding: outstanding.rows,
                monthly: monthList.map((month) => ({
                    month: month.label,
                    key: month.key,
                    received: paymentMonthly.rows.find((row) => row.month === month.key)?.net ?? '0',
                })),
            },
            tours: tourTotals.rows[0] ?? {
                total: 0,
                scheduled: 0,
                in_progress: 0,
                completed: 0,
                cancelled: 0,
            },
        },
    });
}));
reportsRouter.get('/enquiries.csv', asyncHandler(async (req, res) => {
    const range = resolveRange(req);
    const status = queryString(req, 'status');
    const source = queryString(req, 'source');
    const q = queryString(req, 'q');
    const params = [range.from, range.to];
    const conditions = ['e.created_at >= $1::date', "e.created_at < ($2::date + interval '1 day')"];
    if (status) {
        params.push(status.split(',').filter(Boolean));
        conditions.push(`e.status = ANY($${params.length})`);
    }
    if (source) {
        params.push(source);
        conditions.push(`e.source = $${params.length}`);
    }
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(e.reference ILIKE $${params.length} OR c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.email ILIKE $${params.length})`);
    }
    const rows = await getDb().query(`SELECT e.reference, e.created_at, c.first_name || ' ' || c.last_name AS customer, c.email, c.phone,
              e.source, e.status, p.name AS product, e.travel_date_start, e.travel_date_end,
              e.adults, e.children, e.country, e.budget_amount, e.budget_currency, e.follow_up_date,
              e.converted_at, e.lost_reason
         FROM enquiries e
         JOIN customers c ON c.id = e.customer_id
         LEFT JOIN products p ON p.id = e.product_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY e.created_at DESC`, params);
    const csv = toCsv(rows.rows, [
        { key: 'reference', label: 'Reference' },
        { key: 'created_at', label: 'Created' },
        { key: 'customer', label: 'Customer' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'source', label: 'Source' },
        { key: 'status', label: 'Status' },
        { key: 'product', label: 'Product' },
        { key: 'travel_date_start', label: 'Travel start' },
        { key: 'travel_date_end', label: 'Travel end' },
        { key: 'adults', label: 'Adults' },
        { key: 'children', label: 'Children' },
        { key: 'country', label: 'Country' },
        { key: 'budget_amount', label: 'Budget' },
        { key: 'budget_currency', label: 'Budget currency' },
        { key: 'follow_up_date', label: 'Follow-up date' },
        { key: 'converted_at', label: 'Converted at' },
        { key: 'lost_reason', label: 'Lost reason' },
    ]);
    sendCsv(res, `erniza-enquiries-${range.from}-to-${range.to}.csv`, csv);
}));
reportsRouter.get('/bookings.csv', asyncHandler(async (req, res) => {
    const range = resolveRange(req);
    const status = queryString(req, 'status');
    const q = queryString(req, 'q');
    const params = [range.from, range.to];
    const conditions = ['b.travel_date_start >= $1::date', 'b.travel_date_start <= $2::date'];
    if (status) {
        params.push(status.split(',').filter(Boolean));
        conditions.push(`b.status = ANY($${params.length})`);
    }
    if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(b.reference ILIKE $${params.length} OR c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR q.reference ILIKE $${params.length})`);
    }
    const rows = await getDb().query(`SELECT b.reference, q.reference AS quotation, c.first_name || ' ' || c.last_name AS customer,
              c.email, c.phone, p.name AS product, b.status, b.travel_date_start, b.travel_date_end,
              b.adults, b.children, b.currency, b.total_amount,
              COALESCE((SELECT sum(CASE WHEN pay.type = 'refund' THEN -pay.amount ELSE pay.amount END)
                          FROM payments pay WHERE pay.booking_id = b.id), 0)
              + COALESCE((SELECT sum(adj.amount) FROM payment_adjustments adj WHERE adj.booking_id = b.id), 0) AS amount_paid,
              b.guide_name, b.driver_name, b.vehicle, b.created_at
         FROM bookings b
         JOIN customers c ON c.id = b.customer_id
         JOIN quotations q ON q.id = b.quotation_id
         LEFT JOIN products p ON p.id = b.product_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY b.travel_date_start DESC`, params);
    const csv = toCsv(rows.rows.map((row) => ({
        ...row,
        balance: (Number(row.total_amount) - Number(row.amount_paid ?? 0)).toFixed(2),
    })), [
        { key: 'reference', label: 'Booking' },
        { key: 'quotation', label: 'Quotation' },
        { key: 'customer', label: 'Customer' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'product', label: 'Product' },
        { key: 'status', label: 'Status' },
        { key: 'travel_date_start', label: 'Departure' },
        { key: 'travel_date_end', label: 'Return' },
        { key: 'adults', label: 'Adults' },
        { key: 'children', label: 'Children' },
        { key: 'currency', label: 'Currency' },
        { key: 'total_amount', label: 'Total' },
        { key: 'amount_paid', label: 'Paid' },
        { key: 'balance', label: 'Balance' },
        { key: 'guide_name', label: 'Guide' },
        { key: 'driver_name', label: 'Driver' },
        { key: 'vehicle', label: 'Vehicle' },
        { key: 'created_at', label: 'Created' },
    ]);
    sendCsv(res, `erniza-bookings-${range.from}-to-${range.to}.csv`, csv);
}));
reportsRouter.get('/payments.csv', asyncHandler(async (req, res) => {
    const range = resolveRange(req);
    const type = queryString(req, 'type');
    const method = queryString(req, 'method');
    const currency = queryString(req, 'currency');
    const params = [range.from, range.to];
    const conditions = ['pay.paid_at >= $1::date', 'pay.paid_at <= $2::date'];
    if (type) {
        params.push(type);
        conditions.push(`pay.type = $${params.length}`);
    }
    if (method) {
        params.push(method);
        conditions.push(`pay.method = $${params.length}`);
    }
    if (currency) {
        params.push(currency);
        conditions.push(`pay.currency = $${params.length}`);
    }
    const rows = await getDb().query(`SELECT pay.reference, pay.receipt_number, b.reference AS booking, c.first_name || ' ' || c.last_name AS customer,
              pay.type, pay.method, pay.amount, pay.currency, pay.paid_at, pay.external_reference, pay.notes,
              u.full_name AS recorded_by, pay.created_at
         FROM payments pay
         JOIN bookings b ON b.id = pay.booking_id
         JOIN customers c ON c.id = pay.customer_id
         LEFT JOIN admin_users u ON u.id = pay.recorded_by
        WHERE ${conditions.join(' AND ')}
        ORDER BY pay.paid_at DESC, pay.created_at DESC`, params);
    const csv = toCsv(rows.rows, [
        { key: 'reference', label: 'Payment' },
        { key: 'receipt_number', label: 'Receipt' },
        { key: 'booking', label: 'Booking' },
        { key: 'customer', label: 'Customer' },
        { key: 'type', label: 'Type' },
        { key: 'method', label: 'Method' },
        { key: 'amount', label: 'Amount' },
        { key: 'currency', label: 'Currency' },
        { key: 'paid_at', label: 'Paid on' },
        { key: 'external_reference', label: 'External reference' },
        { key: 'notes', label: 'Notes' },
        { key: 'recorded_by', label: 'Recorded by' },
        { key: 'created_at', label: 'Created' },
    ]);
    sendCsv(res, `erniza-payments-${range.from}-to-${range.to}.csv`, csv);
}));
