import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { asyncHandler } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { getSettings } from '../../services/settings.js';
import { expireQuotations } from '../quotations/service.js';
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get('/', asyncHandler(async (_req, res) => {
    await expireQuotations();
    const db = getDb();
    const settings = await getSettings();
    const defaultCurrency = settings.billing.defaultCurrency;
    const months = [];
    const now = new Date();
    for (let index = 5; index >= 0; index -= 1) {
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
        months.push({
            key: date.toISOString().slice(0, 7),
            label: new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date),
            start: date.toISOString().slice(0, 10),
        });
    }
    const [enquiryStats, quotationStats, bookingStats, tourStats, balances, bookingValues, paymentsReceived, monthlyBookings, monthlyPayments, enquiryStatus, enquirySources, recentEnquiries, upcomingDepartures, recentActivity,] = await Promise.all([
        db.query(`SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'new')::int AS new_count,
                count(*) FILTER (
                  WHERE status NOT IN ('converted','lost')
                    AND (status = 'follow_up' OR (follow_up_date IS NOT NULL AND follow_up_date <= current_date))
                )::int AS follow_up
           FROM enquiries`),
        db.query(`SELECT count(*)::int AS awaiting FROM quotations WHERE status = 'sent'`),
        db.query(`SELECT
           count(*) FILTER (WHERE status IN ('confirmed','in_progress') AND travel_date_end >= current_date)::int AS upcoming,
           count(*) FILTER (WHERE status IN ('confirmed','in_progress','completed'))::int AS confirmed
         FROM bookings`),
        db.query(`SELECT count(*)::int AS upcoming FROM tours
          WHERE status = 'scheduled' AND departure_date >= current_date`),
        db.query(`WITH booking_paid AS (
           SELECT b.id, b.currency, b.total_amount,
                  COALESCE((SELECT sum(CASE WHEN p.type='refund' THEN -p.amount ELSE p.amount END)
                              FROM payments p WHERE p.booking_id = b.id), 0)
                  + COALESCE((SELECT sum(a.amount) FROM payment_adjustments a WHERE a.booking_id = b.id), 0) AS paid
             FROM bookings b WHERE b.status IN ('pending_confirmation','confirmed','in_progress','completed')
         )
         SELECT currency, sum(total_amount - paid)::text AS balance
           FROM booking_paid GROUP BY currency HAVING sum(total_amount - paid) <> 0 ORDER BY currency`),
        db.query(`SELECT currency, sum(total_amount)::text AS value FROM bookings
          WHERE status IN ('confirmed','in_progress','completed') GROUP BY currency ORDER BY currency`),
        db.query(`SELECT currency, sum(CASE WHEN type='refund' THEN -amount ELSE amount END)::text AS received
           FROM payments GROUP BY currency ORDER BY currency`),
        db.query(`SELECT to_char(created_at, 'YYYY-MM') AS month, count(*)::int AS bookings,
                COALESCE(sum(total_amount), 0)::text AS revenue
           FROM bookings
          WHERE currency = $1 AND status IN ('confirmed','in_progress','completed')
            AND created_at >= $2::date
          GROUP BY 1`, [defaultCurrency, months[0].start]),
        db.query(`SELECT to_char(paid_at, 'YYYY-MM') AS month,
                sum(CASE WHEN type='refund' THEN -amount ELSE amount END)::text AS received
           FROM payments WHERE currency = $1 AND paid_at >= $2::date
          GROUP BY 1`, [defaultCurrency, months[0].start]),
        db.query(`SELECT status, count(*)::int AS count FROM enquiries GROUP BY status ORDER BY status`),
        db.query(`SELECT source, count(*)::int AS count FROM enquiries GROUP BY source ORDER BY count DESC`),
        db.query(`SELECT e.*, c.first_name, c.last_name, c.email AS customer_email, c.phone AS customer_phone, p.name AS product_name
           FROM enquiries e JOIN customers c ON c.id = e.customer_id LEFT JOIN products p ON p.id = e.product_id
          ORDER BY e.created_at DESC LIMIT 8`),
        db.query(`SELECT b.*, c.first_name, c.last_name, q.reference AS quotation_reference, p.name AS product_name,
                COALESCE((SELECT sum(CASE WHEN pay.type='refund' THEN -pay.amount ELSE pay.amount END)
                            FROM payments pay WHERE pay.booking_id = b.id), 0)
                + COALESCE((SELECT sum(adj.amount) FROM payment_adjustments adj WHERE adj.booking_id = b.id), 0) AS amount_paid
           FROM bookings b
           JOIN customers c ON c.id = b.customer_id
           JOIN quotations q ON q.id = b.quotation_id
           LEFT JOIN products p ON p.id = b.product_id
          WHERE b.status IN ('confirmed','in_progress') AND b.travel_date_end >= current_date
          ORDER BY b.travel_date_start LIMIT 6`),
        db.query(`SELECT id, actor_email, action, entity_type, entity_id, changes, created_at
           FROM audit_logs ORDER BY created_at DESC LIMIT 10`),
    ]);
    const total = enquiryStats.rows[0]?.total ?? 0;
    const converted = enquiryStatus.rows.find((row) => row.status === 'converted')?.count ?? 0;
    const balanceFor = (currency, rows) => rows.find((row) => row.currency === currency)?.balance ?? '0';
    const valueFor = (currency, rows) => rows.find((row) => row.currency === currency)?.value ?? '0';
    const receivedFor = (currency, rows) => rows.find((row) => row.currency === currency)?.received ?? '0';
    res.json({
        data: {
            stats: {
                totalEnquiries: total,
                newEnquiries: enquiryStats.rows[0]?.new_count ?? 0,
                awaitingFollowUp: enquiryStats.rows[0]?.follow_up ?? 0,
                quotationsAwaiting: quotationStats.rows[0]?.awaiting ?? 0,
                confirmedUpcomingBookings: bookingStats.rows[0]?.upcoming ?? 0,
                upcomingTours: tourStats.rows[0]?.upcoming ?? 0,
                outstandingBalance: balanceFor(defaultCurrency, balances.rows),
                outstandingCurrency: defaultCurrency,
                paymentReceived: receivedFor(defaultCurrency, paymentsReceived.rows),
                paymentsReceived: receivedFor(defaultCurrency, paymentsReceived.rows),
                bookingValue: valueFor(defaultCurrency, bookingValues.rows),
                conversionRate: total > 0 ? Math.round((converted / total) * 1000) / 10 : 0,
                totalBookings: bookingStats.rows[0]?.confirmed ?? 0,
            },
            outstandingByCurrency: balances.rows,
            valuesByCurrency: bookingValues.rows,
            receivedByCurrency: paymentsReceived.rows,
            monthly: months.map((month) => ({
                month: month.label,
                bookings: monthlyBookings.rows.find((row) => row.month === month.key)?.bookings ?? 0,
                revenue: monthlyBookings.rows.find((row) => row.month === month.key)?.revenue ?? '0',
                received: monthlyPayments.rows.find((row) => row.month === month.key)?.received ?? '0',
            })),
            enquiryStatus: enquiryStatus.rows,
            enquirySources: enquirySources.rows,
            recentEnquiries: recentEnquiries.rows.map((row) => ({
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
            })),
            upcomingDepartures: upcomingDepartures.rows.map((row) => {
                const paid = Number(row.amount_paid ?? 0);
                return {
                    id: row.id,
                    reference: row.reference,
                    customerName: `${row.first_name} ${row.last_name}`,
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
                    balance: (Number(row.total_amount) - paid).toFixed(2),
                    paymentStatus: paid >= Number(row.total_amount) ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
                    createdAt: row.created_at,
                };
            }),
            recentActivity: recentActivity.rows.map((row) => ({
                id: String(row.id),
                actorEmail: row.actor_email,
                action: row.action,
                entityType: row.entity_type,
                entityId: row.entity_id,
                changes: row.changes,
                createdAt: row.created_at,
            })),
        },
    });
}));
