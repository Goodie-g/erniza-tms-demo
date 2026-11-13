import { getDb } from '../../db/client.js';
import { notFound } from '../../lib/errors.js';
import { computePaymentTotals } from '../../lib/money.js';
export async function loadBooking(id) {
    const db = getDb();
    const result = await db.query(`SELECT b.*, c.first_name, c.last_name, c.email AS customer_email, c.phone AS customer_phone,
            c.reference AS customer_reference, c.country AS customer_country,
            q.reference AS quotation_reference, q.current_version AS quotation_version,
            p.name AS product_name
       FROM bookings b
       JOIN customers c ON c.id = b.customer_id
       JOIN quotations q ON q.id = b.quotation_id
       LEFT JOIN products p ON p.id = b.product_id
      WHERE b.id = $1`, [id]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Booking not found');
    const [travellers, payments, adjustments, tour, itineraryDays, audit] = await Promise.all([
        db.query('SELECT * FROM booking_travellers WHERE booking_id = $1 ORDER BY is_lead DESC, created_at', [id]),
        db.query(`SELECT pay.*, u.full_name AS recorded_by_name FROM payments pay
         LEFT JOIN admin_users u ON u.id = pay.recorded_by
        WHERE pay.booking_id = $1 ORDER BY pay.paid_at, pay.created_at`, [id]),
        db.query(`SELECT a.*, u.full_name AS created_by_name FROM payment_adjustments a
         LEFT JOIN admin_users u ON u.id = a.created_by
        WHERE a.booking_id = $1 ORDER BY a.created_at`, [id]),
        db.query(`SELECT t.* FROM tours t WHERE t.booking_id = $1`, [id]),
        db.query('SELECT * FROM booking_itineraries WHERE booking_id = $1 ORDER BY day_number', [id]),
        db.query(`SELECT a.id, a.action, a.actor_email, a.changes, a.created_at FROM audit_logs a
        WHERE a.entity_type = 'booking' AND a.entity_id = $1 ORDER BY a.created_at DESC LIMIT 50`, [id]),
    ]);
    const totals = computePaymentTotals(row.total_amount, payments.rows.map((payment) => ({ type: payment.type, amount: payment.amount })), adjustments.rows.map((adjustment) => ({ amount: adjustment.amount })));
    return {
        id: row.id,
        reference: row.reference,
        customerId: row.customer_id,
        customerName: `${row.first_name} ${row.last_name}`,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        customerReference: row.customer_reference,
        customerCountry: row.customer_country,
        productId: row.product_id,
        productName: row.product_name,
        quotationId: row.quotation_id,
        quotationReference: row.quotation_reference,
        quotationVersion: row.quotation_version,
        status: row.status,
        travelDateStart: row.travel_date_start,
        travelDateEnd: row.travel_date_end,
        adults: row.adults,
        children: row.children,
        currency: row.currency,
        totalAmount: row.total_amount,
        amountPaid: totals.paid,
        balance: totals.balance,
        paymentStatus: totals.status,
        accommodation: row.accommodation,
        itinerary: row.itinerary,
        specialRequirements: row.special_requirements,
        operationalNotes: row.operational_notes,
        guideName: row.guide_name,
        driverName: row.driver_name,
        vehicle: row.vehicle,
        cancellationReason: row.cancellation_reason,
        cancelledAt: row.cancelled_at,
        confirmedAt: row.confirmed_at,
        completedAt: row.completed_at,
        snapshot: row.snapshot,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        travellers: travellers.rows.map((traveller) => ({
            id: traveller.id,
            bookingId: traveller.booking_id,
            firstName: traveller.first_name,
            lastName: traveller.last_name,
            email: traveller.email,
            phone: traveller.phone,
            dateOfBirth: traveller.date_of_birth,
            passportNumber: traveller.passport_number,
            nationality: traveller.nationality,
            isLead: traveller.is_lead,
        })),
        payments: payments.rows.map((payment) => ({
            id: payment.id,
            reference: payment.reference,
            receiptNumber: payment.receipt_number,
            bookingId: payment.booking_id,
            type: payment.type,
            method: payment.method,
            amount: payment.amount,
            currency: payment.currency,
            paidAt: payment.paid_at,
            externalReference: payment.external_reference,
            notes: payment.notes,
            recordedByName: payment.recorded_by_name,
            createdAt: payment.created_at,
        })),
        adjustments: adjustments.rows.map((adjustment) => ({
            id: adjustment.id,
            bookingId: adjustment.booking_id,
            paymentId: adjustment.payment_id,
            kind: adjustment.kind,
            amount: adjustment.amount,
            currency: adjustment.currency,
            reason: adjustment.reason,
            createdByName: adjustment.created_by_name,
            createdAt: adjustment.created_at,
        })),
        tour: tour.rows[0]
            ? {
                id: tour.rows[0].id,
                reference: tour.rows[0].reference,
                title: tour.rows[0].title,
                status: tour.rows[0].status,
                departureDate: tour.rows[0].departure_date,
                returnDate: tour.rows[0].return_date,
                guideName: tour.rows[0].guide_name,
                driverName: tour.rows[0].driver_name,
                vehicle: tour.rows[0].vehicle,
                notes: tour.rows[0].notes,
            }
            : null,
        itineraryDays: itineraryDays.rows.map((day) => ({
            id: day.id,
            dayNumber: day.day_number,
            title: day.title,
            description: day.description,
            accommodation: day.accommodation,
            meals: day.meals,
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
