import { getDb } from '../../db/client.js';
import { conflict, notFound } from '../../lib/errors.js';
import { computeQuotationTotals } from '../../lib/money.js';
import { getSettings } from '../../services/settings.js';
export async function writeQuotationItems(tx, quotationId, items, discountAmount, taxRate) {
    if (items.length === 0) {
        await tx.query('DELETE FROM quotation_items WHERE quotation_id = $1', [quotationId]);
        await tx.query(`UPDATE quotations SET subtotal = 0, discount_amount = 0, tax_rate = $2, tax_amount = 0, total = 0, updated_at = now()
       WHERE id = $1`, [quotationId, taxRate]);
        return { subtotal: '0.00', discountAmount: '0.00', taxRate: Number(taxRate).toFixed(3), taxAmount: '0.00', total: '0.00' };
    }
    const totals = computeQuotationTotals(items, discountAmount, taxRate);
    await tx.query('DELETE FROM quotation_items WHERE quotation_id = $1', [quotationId]);
    for (let index = 0; index < totals.items.length; index += 1) {
        const item = totals.items[index];
        await tx.query(`INSERT INTO quotation_items (quotation_id, description, quantity, unit_price, total_price, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6)`, [quotationId, item.description, item.quantity, item.unitPrice, item.totalPrice, index]);
    }
    await tx.query(`UPDATE quotations SET subtotal = $2, discount_amount = $3, tax_rate = $4, tax_amount = $5, total = $6, updated_at = now()
     WHERE id = $1`, [quotationId, totals.subtotal, totals.discountAmount, totals.taxRate, totals.taxAmount, totals.total]);
    return {
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
    };
}
export async function createQuotationVersion(tx, quotationId, status) {
    const result = await tx.query(`SELECT q.*, c.reference AS customer_reference, c.first_name, c.last_name, c.email, c.phone,
            c.whatsapp, c.country, c.preferred_channel,
            p.name AS product_name, p.slug AS product_slug
       FROM quotations q
       JOIN customers c ON c.id = q.customer_id
       LEFT JOIN products p ON p.id = q.primary_product_id
      WHERE q.id = $1`, [quotationId]);
    const quotation = result.rows[0];
    if (!quotation)
        throw notFound('Quotation not found');
    const items = await tx.query(`SELECT description, quantity, unit_price, total_price, sort_order
       FROM quotation_items WHERE quotation_id = $1 ORDER BY sort_order`, [quotationId]);
    let itineraryDays = [];
    if (quotation.primary_product_id) {
        const days = await tx.query(`SELECT d.day_number, d.title, d.description, d.accommodation, d.meals
         FROM itinerary_days d JOIN itineraries i ON i.id = d.itinerary_id
        WHERE i.product_id = $1 ORDER BY d.day_number`, [quotation.primary_product_id]);
        itineraryDays = days.rows;
    }
    const snapshot = {
        quotation: {
            reference: quotation.reference,
            status,
            currency: quotation.currency,
            travelDateStart: quotation.travel_date_start,
            travelDateEnd: quotation.travel_date_end,
            adults: quotation.adults,
            children: quotation.children,
            accommodation: quotation.accommodation,
            itinerary: quotation.itinerary,
            specialArrangements: quotation.special_arrangements,
            paymentTerms: quotation.payment_terms,
            validityUntil: quotation.validity_until,
            notes: quotation.notes,
            subtotal: quotation.subtotal,
            discountAmount: quotation.discount_amount,
            taxRate: quotation.tax_rate,
            taxAmount: quotation.tax_amount,
            total: quotation.total,
        },
        items: items.rows.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
        })),
        customer: {
            id: quotation.customer_id,
            reference: quotation.customer_reference,
            firstName: quotation.first_name,
            lastName: quotation.last_name,
            email: quotation.email,
            phone: quotation.phone,
            whatsapp: quotation.whatsapp,
            country: quotation.country,
        },
        product: quotation.primary_product_id
            ? { id: quotation.primary_product_id, name: quotation.product_name, slug: quotation.product_slug }
            : null,
        itineraryDays,
        capturedAt: new Date().toISOString(),
    };
    const existing = await tx.query('SELECT id FROM quotation_versions WHERE quotation_id = $1 AND version_number = $2', [quotationId, quotation.current_version]);
    if (existing.rows[0]) {
        throw conflict('This quotation version has already been issued. Create a revision first.');
    }
    const inserted = await tx.query(`INSERT INTO quotation_versions
      (quotation_id, version_number, status, currency, subtotal, discount_amount, tax_amount, total, snapshot, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [
        quotationId,
        quotation.current_version,
        status,
        quotation.currency,
        quotation.subtotal,
        quotation.discount_amount,
        quotation.tax_amount,
        quotation.total,
        JSON.stringify(snapshot),
        quotation.created_by,
    ]);
    return { id: inserted.rows[0].id, versionNumber: quotation.current_version };
}
export async function expireQuotations(db = getDb()) {
    await db.query(`UPDATE quotations SET status = 'expired', updated_at = now()
      WHERE status = 'sent' AND validity_until IS NOT NULL AND validity_until < current_date`);
}
export async function loadQuotation(id) {
    const db = getDb();
    const result = await db.query(`SELECT q.*, c.first_name, c.last_name, c.email AS customer_email, c.phone AS customer_phone,
            c.reference AS customer_reference, c.country AS customer_country,
            e.reference AS enquiry_reference, p.name AS product_name,
            b.id AS booking_id, b.reference AS booking_reference
       FROM quotations q
       JOIN customers c ON c.id = q.customer_id
       LEFT JOIN enquiries e ON e.id = q.enquiry_id
       LEFT JOIN products p ON p.id = q.primary_product_id
       LEFT JOIN bookings b ON b.quotation_id = q.id
      WHERE q.id = $1`, [id]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Quotation not found');
    const [items, versions] = await Promise.all([
        db.query(`SELECT id, description, quantity, unit_price, total_price, sort_order
         FROM quotation_items WHERE quotation_id = $1 ORDER BY sort_order`, [id]),
        db.query(`SELECT v.id, v.version_number, v.status, v.currency, v.subtotal, v.discount_amount, v.tax_amount, v.total,
              v.created_at, v.snapshot, u.full_name AS created_by_name
         FROM quotation_versions v LEFT JOIN admin_users u ON u.id = v.created_by
        WHERE v.quotation_id = $1 ORDER BY v.version_number DESC`, [id]),
    ]);
    return {
        id: row.id,
        reference: row.reference,
        customerId: row.customer_id,
        customerName: `${row.first_name} ${row.last_name}`,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        customerReference: row.customer_reference,
        customerCountry: row.customer_country,
        enquiryId: row.enquiry_id,
        enquiryReference: row.enquiry_reference,
        primaryProductId: row.primary_product_id,
        productName: row.product_name,
        bookingId: row.booking_id,
        bookingReference: row.booking_reference,
        status: row.status,
        currentVersion: row.current_version,
        currency: row.currency,
        travelDateStart: row.travel_date_start,
        travelDateEnd: row.travel_date_end,
        adults: row.adults,
        children: row.children,
        accommodation: row.accommodation,
        itinerary: row.itinerary,
        specialArrangements: row.special_arrangements,
        paymentTerms: row.payment_terms,
        validityUntil: row.validity_until,
        notes: row.notes,
        subtotal: row.subtotal,
        discountAmount: row.discount_amount,
        taxRate: row.tax_rate,
        taxAmount: row.tax_amount,
        total: row.total,
        issuedAt: row.issued_at,
        acceptedAt: row.accepted_at,
        rejectedAt: row.rejected_at,
        revisedAt: row.revised_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        items: items.rows.map((item) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
            sortOrder: item.sort_order,
        })),
        versions: versions.rows.map((version) => ({
            id: version.id,
            versionNumber: version.version_number,
            status: version.status,
            currency: version.currency,
            subtotal: version.subtotal,
            discountAmount: version.discount_amount,
            taxAmount: version.tax_amount,
            total: version.total,
            createdAt: version.created_at,
            createdByName: version.created_by_name,
            snapshot: version.snapshot,
        })),
    };
}
export async function defaultQuotationHeader(customerId, enquiryId) {
    const settings = await getSettings();
    void customerId;
    void enquiryId;
    return {
        currency: settings.billing.defaultCurrency,
        paymentTerms: settings.billing.defaultPaymentTerms,
        taxRate: settings.billing.defaultTaxRate,
    };
}
export function mapItemsForWrite(items) {
    return items.map((item) => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice }));
}
