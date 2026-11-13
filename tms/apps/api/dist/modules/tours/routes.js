import { assignmentCreateSchema, tourCreateSchema, tourUpdateSchema } from '@erniza/shared';
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { asyncHandler, conflict, notFound, unprocessable } from '../../lib/errors.js';
import { paginationMeta, parsePagination, queryDate, queryString } from '../../lib/pagination.js';
import { nextReference } from '../../lib/reference.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
export const toursRouter = Router();
toursRouter.use(requireAuth);
toursRouter.get('/', asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req, 100);
    const status = queryString(req, 'status');
    const from = queryDate(req, 'from');
    const to = queryDate(req, 'to');
    const params = [];
    const conditions = [];
    if (status) {
        params.push(status.split(',').filter(Boolean));
        conditions.push(`t.status = ANY($${params.length})`);
    }
    if (from) {
        params.push(from);
        conditions.push(`t.return_date >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        conditions.push(`t.departure_date <= $${params.length}::date`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const [count, rows] = await Promise.all([
        db.query(`SELECT count(*)::int AS total FROM tours t ${where}`, params),
        db.query(`SELECT t.*, b.reference AS booking_reference, b.status AS booking_status,
                c.first_name, c.last_name, p.name AS product_name,
                (SELECT count(*)::int FROM tour_assignments ta WHERE ta.tour_id = t.id) AS assignment_count
           FROM tours t
           JOIN bookings b ON b.id = t.booking_id
           JOIN customers c ON c.id = b.customer_id
           LEFT JOIN products p ON p.id = b.product_id
           ${where}
          ORDER BY t.departure_date
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]),
    ]);
    res.json({
        data: rows.rows.map((row) => ({
            id: row.id,
            reference: row.reference,
            bookingId: row.booking_id,
            bookingReference: row.booking_reference,
            bookingStatus: row.booking_status,
            customerName: `${row.first_name} ${row.last_name}`,
            productName: row.product_name,
            title: row.title,
            status: row.status,
            departureDate: row.departure_date,
            returnDate: row.return_date,
            guideName: row.guide_name,
            driverName: row.driver_name,
            vehicle: row.vehicle,
            notes: row.notes,
            assignmentCount: row.assignment_count,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        })),
        meta: paginationMeta(page, pageSize, count.rows[0]?.total ?? 0),
    });
}));
toursRouter.post('/', validate(tourCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    if (input.returnDate < input.departureDate)
        throw unprocessable('The return date cannot be before departure.');
    const actor = req.authUser;
    const db = getDb();
    const id = await db.transaction(async (tx) => {
        const bookingResult = await tx.query(`SELECT b.*, c.first_name, c.last_name, p.name AS product_name
           FROM bookings b JOIN customers c ON c.id = b.customer_id
           LEFT JOIN products p ON p.id = b.product_id
          WHERE b.id = $1 FOR UPDATE`, [input.bookingId]);
        const booking = bookingResult.rows[0];
        if (!booking)
            throw notFound('Booking not found');
        if (!['confirmed', 'in_progress'].includes(booking.status)) {
            throw conflict('A tour can only be created for a confirmed or in-progress booking.');
        }
        const existing = await tx.query('SELECT id FROM tours WHERE booking_id = $1', [input.bookingId]);
        if (existing.rows[0])
            throw conflict('This booking already has a tour.');
        const reference = await nextReference(tx, 'TOU');
        const title = input.title ??
            `${booking.first_name} ${booking.last_name} - ${booking.product_name ?? 'Tanzania safari'} (${booking.reference})`;
        const result = await tx.query(`INSERT INTO tours (reference, booking_id, title, departure_date, return_date, guide_name, driver_name, vehicle, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [
            reference,
            input.bookingId,
            title,
            input.departureDate,
            input.returnDate,
            input.guideName ?? booking.guide_name ?? null,
            input.driverName ?? booking.driver_name ?? null,
            input.vehicle ?? booking.vehicle ?? null,
            input.notes ?? null,
        ]);
        const createdId = result.rows[0].id;
        await logAudit(tx, {
            actor,
            action: 'tour.created',
            entityType: 'tour',
            entityId: createdId,
            changes: { reference, booking: booking.reference, departureDate: input.departureDate },
            ...requestAuditContext(req),
        });
        return createdId;
    });
    res.status(201).json({ data: await loadTour(id) });
}));
toursRouter.get('/:id', asyncHandler(async (req, res) => {
    res.json({ data: await loadTour(req.params.id) });
}));
toursRouter.patch('/:id', validate(tourUpdateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const existing = await tx.query('SELECT * FROM tours WHERE id = $1 FOR UPDATE', [req.params.id]);
        const tour = existing.rows[0];
        if (!tour)
            throw notFound('Tour not found');
        const start = input.departureDate ?? tour.departure_date;
        const end = input.returnDate ?? tour.return_date;
        if (end < start)
            throw unprocessable('The return date cannot be before departure.');
        const map = {
            title: 'title',
            status: 'status',
            departureDate: 'departure_date',
            returnDate: 'return_date',
            guideName: 'guide_name',
            driverName: 'driver_name',
            vehicle: 'vehicle',
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
        if (!fields.length)
            return;
        values.push(req.params.id);
        await tx.query(`UPDATE tours SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
        await logAudit(tx, {
            actor,
            action: input.status && input.status !== tour.status ? 'tour.status_changed' : 'tour.updated',
            entityType: 'tour',
            entityId: req.params.id,
            changes: input,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: await loadTour(req.params.id) });
}));
toursRouter.post('/:id/assignments', validate(assignmentCreateSchema), asyncHandler(async (req, res) => {
    const input = req.body;
    const actor = req.authUser;
    const db = getDb();
    const id = await db.transaction(async (tx) => {
        const tour = await tx.query('SELECT id FROM tours WHERE id = $1', [req.params.id]);
        if (!tour.rows[0])
            throw notFound('Tour not found');
        const result = await tx.query(`INSERT INTO tour_assignments (tour_id, role, name, contact, details) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [req.params.id, input.role, input.name, input.contact ?? null, JSON.stringify(input.details ?? {})]);
        await logAudit(tx, {
            actor,
            action: 'tour.assignment_added',
            entityType: 'tour',
            entityId: req.params.id,
            changes: { role: input.role, name: input.name },
            ...requestAuditContext(req),
        });
        return result.rows[0].id;
    });
    res.status(201).json({ data: { id } });
}));
toursRouter.delete('/:id/assignments/:assignmentId', asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    await db.transaction(async (tx) => {
        const result = await tx.query('DELETE FROM tour_assignments WHERE id = $1 AND tour_id = $2 RETURNING id', [
            req.params.assignmentId,
            req.params.id,
        ]);
        if (!result.rows[0])
            throw notFound('Assignment not found');
        await logAudit(tx, {
            actor,
            action: 'tour.assignment_removed',
            entityType: 'tour',
            entityId: req.params.id,
            changes: { assignmentId: req.params.assignmentId },
            ...requestAuditContext(req),
        });
    });
    res.json({ data: { success: true } });
}));
async function loadTour(id) {
    const db = getDb();
    const result = await db.query(`SELECT t.*, b.reference AS booking_reference, b.status AS booking_status, b.adults, b.children,
            b.travel_date_start, b.travel_date_end,
            c.first_name, c.last_name, p.name AS product_name
       FROM tours t
       JOIN bookings b ON b.id = t.booking_id
       JOIN customers c ON c.id = b.customer_id
       LEFT JOIN products p ON p.id = b.product_id
      WHERE t.id = $1`, [id]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Tour not found');
    const [assignments, travellers, itinerary] = await Promise.all([
        db.query('SELECT * FROM tour_assignments WHERE tour_id = $1 ORDER BY role, name', [id]),
        db.query('SELECT * FROM booking_travellers WHERE booking_id = $1 ORDER BY is_lead DESC, created_at', [row.booking_id]),
        db.query('SELECT * FROM booking_itineraries WHERE booking_id = $1 ORDER BY day_number', [row.booking_id]),
    ]);
    return {
        id: row.id,
        reference: row.reference,
        bookingId: row.booking_id,
        bookingReference: row.booking_reference,
        bookingStatus: row.booking_status,
        customerName: `${row.first_name} ${row.last_name}`,
        productName: row.product_name,
        title: row.title,
        status: row.status,
        departureDate: row.departure_date,
        returnDate: row.return_date,
        guideName: row.guide_name,
        driverName: row.driver_name,
        vehicle: row.vehicle,
        notes: row.notes,
        adults: row.adults,
        children: row.children,
        assignments: assignments.rows.map((assignment) => ({
            id: assignment.id,
            tourId: assignment.tour_id,
            role: assignment.role,
            name: assignment.name,
            contact: assignment.contact,
            details: assignment.details,
            createdAt: assignment.created_at,
        })),
        travellers: travellers.rows.map((traveller) => ({
            id: traveller.id,
            firstName: traveller.first_name,
            lastName: traveller.last_name,
            email: traveller.email,
            phone: traveller.phone,
            nationality: traveller.nationality,
            passportNumber: traveller.passport_number,
            isLead: traveller.is_lead,
        })),
        itineraryDays: itinerary.rows.map((day) => ({
            dayNumber: day.day_number,
            title: day.title,
            description: day.description,
            accommodation: day.accommodation,
            meals: day.meals,
        })),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
