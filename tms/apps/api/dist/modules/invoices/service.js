import { getDb } from '../../db/client.js';
import { notFound } from '../../lib/errors.js';
import { decimal, roundMoney } from '../../lib/money.js';
export async function loadInvoice(id) {
    const db = getDb();
    const result = await db.query(`SELECT i.*, c.first_name, c.last_name, c.email AS customer_email,
            b.reference AS booking_reference
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       LEFT JOIN bookings b ON b.id = i.booking_id
      WHERE i.id = $1`, [id]);
    const row = result.rows[0];
    if (!row)
        throw notFound('Invoice not found');
    const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order, created_at', [id]);
    return {
        id: row.id,
        reference: row.reference,
        bookingId: row.booking_id,
        bookingReference: row.booking_reference,
        customerId: row.customer_id,
        customerName: `${row.first_name} ${row.last_name}`,
        customerEmail: row.customer_email,
        status: row.status,
        currency: row.currency,
        subtotal: row.subtotal,
        taxRate: row.tax_rate,
        taxAmount: row.tax_amount,
        total: row.total,
        amountPaid: row.amount_paid,
        balance: row.balance,
        issueDate: row.issue_date,
        dueDate: row.due_date,
        paymentTerms: row.payment_terms,
        notes: row.notes,
        issuedAt: row.issued_at,
        sentAt: row.sent_at,
        paidAt: row.paid_at,
        cancelledAt: row.cancelled_at,
        cancellationReason: row.cancellation_reason,
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
    };
}
export function computeInvoiceTotals(items, taxRate) {
    const subtotal = items.reduce((sum, item) => sum.plus(decimal(item.quantity).times(decimal(item.unitPrice))), decimal(0));
    const tax = subtotal.times(decimal(taxRate)).dividedBy(100);
    const total = subtotal.plus(tax);
    return {
        subtotal: roundMoney(subtotal),
        taxAmount: roundMoney(tax),
        total: roundMoney(total),
    };
}
