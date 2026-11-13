import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { formatMoney } from '@erniza/shared';
import { getDb } from '../db/client.js';
import { notFound } from '../lib/errors.js';
import { getSettings } from './settings.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const LOGO_CANDIDATES = [
    path.resolve(here, '../../assets/logo.png'),
    path.resolve(process.cwd(), 'assets/logo.png'),
];
const LOGO_PATH = LOGO_CANDIDATES.find((candidate) => fs.existsSync(candidate));
const FOREST = '#2c4a2e';
const GOLD = '#c99c4a';
const CREAM = '#fcf9f2';
const INK = '#2e2b26';
const MUTED = '#6f6f5e';
function formatDate(value) {
    if (!value)
        return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime()))
        return '—';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Africa/Dar_es_Salaam',
    }).format(date);
}
function formatDateTime(value) {
    if (!value)
        return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime()))
        return '—';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Dar_es_Salaam',
    }).format(date);
}
function drawHeader(doc, company, title, subtitle) {
    if (LOGO_PATH) {
        try {
            doc.image(LOGO_PATH, 48, 36, { height: 46 });
        }
        catch {
            // Logo is optional; never fail document generation because of branding.
        }
    }
    doc
        .fillColor(FOREST)
        .font('Helvetica-Bold')
        .fontSize(15)
        .text(company.name, 300, 40, { width: 247, align: 'right' })
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(`${company.address}, ${company.city}, ${company.country}`, 300, 58, { width: 247, align: 'right' })
        .text(`${company.phone}  |  ${company.email}`, 300, 70, { width: 247, align: 'right' })
        .text(company.website, 300, 82, { width: 247, align: 'right' });
    doc
        .fillColor(GOLD)
        .rect(48, 102, 499, 2)
        .fill();
    doc
        .fillColor(FOREST)
        .font('Helvetica-Bold')
        .fontSize(19)
        .text(title, 48, 118)
        .font('Helvetica')
        .fontSize(9)
        .fillColor(MUTED);
    if (subtitle)
        doc.text(subtitle, 48, 141);
    doc.y = 160;
}
function sectionTitle(doc, text) {
    ensureSpace(doc, 30);
    doc.fillColor(FOREST).font('Helvetica-Bold').fontSize(10).text(text.toUpperCase(), { characterSpacing: 0.8 });
    doc.moveDown(0.4);
}
function ensureSpace(doc, needed) {
    const bottom = doc.page.height - doc.page.margins.bottom - 20;
    if (doc.y + needed > bottom)
        doc.addPage();
}
function companyFooter(doc, company, billing) {
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
        const page = doc.switchToPage(range.start + index);
        void page;
        const footerY = doc.page.height - 48;
        doc
            .strokeColor('#e5e0d5')
            .lineWidth(0.5)
            .moveTo(48, footerY - 8)
            .lineTo(547, footerY - 8)
            .stroke();
        doc
            .fillColor(MUTED)
            .font('Helvetica')
            .fontSize(7.5)
            .text(billing.quoteFooter || `${company.name} - ${company.email}`, 48, footerY, { width: 360 });
        doc.text(`Page ${index + 1} of ${range.count}`, 437, footerY, { width: 110, align: 'right' });
    }
}
function amount(value, currency) {
    return formatMoney(value, currency);
}
export async function renderQuotationPdf(id, res, versionId) {
    const db = getDb();
    const quotationResult = await db.query(`SELECT q.*, c.reference AS customer_reference, c.first_name, c.last_name, c.email, c.phone, c.whatsapp,
            c.country, p.name AS product_name
       FROM quotations q JOIN customers c ON c.id = q.customer_id
       LEFT JOIN products p ON p.id = q.primary_product_id
      WHERE q.id = $1`, [id]);
    const quotation = quotationResult.rows[0];
    if (!quotation)
        throw notFound('Quotation not found');
    const settings = await getSettings();
    const versions = await db.query(`SELECT * FROM quotation_versions WHERE quotation_id = $1 ORDER BY version_number DESC`, [id]);
    let version = versionId
        ? versions.rows.find((row) => String(row.version_number) === versionId)
        : versions.rows[0];
    let items;
    let snapshot = version?.snapshot ?? null;
    if (!versionId && ['draft', 'revised'].includes(quotation.status)) {
        snapshot = null;
        version = undefined;
    }
    if (snapshot) {
        items = snapshot.items ?? [];
    }
    else {
        const itemRows = await db.query('SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY sort_order', [id]);
        items = itemRows.rows.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
        }));
    }
    const currency = quotation.currency;
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: `Quotation ${quotation.reference}`, Author: settings.company.name } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quotation.reference}.pdf"`);
    doc.pipe(res);
    drawHeader(doc, settings.company, 'QUOTATION', `${quotation.reference}${version ? `  |  Version ${version.version_number}` : '  |  Draft'}  |  Issued ${formatDate(quotation.issued_at ?? new Date())}`);
    // Customer and travel details
    const topY = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('PREPARED FOR', 48, topY);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(`${quotation.first_name} ${quotation.last_name}`, 48, topY + 13);
    doc.font('Helvetica').fontSize(9).fillColor(INK);
    const customerLines = [
        quotation.customer_reference,
        quotation.email,
        quotation.phone,
        quotation.country,
    ].filter(Boolean);
    customerLines.forEach((line, index) => doc.text(String(line), 48, topY + 29 + index * 13));
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('TRIP DETAILS', 310, topY);
    doc.font('Helvetica').fontSize(9).fillColor(INK);
    const tripLines = [
        [`Travel dates`, `${formatDate(quotation.travel_date_start)} - ${formatDate(quotation.travel_date_end)}`],
        ['Travellers', `${quotation.adults} adult${quotation.adults === 1 ? '' : 's'}${quotation.children ? `, ${quotation.children} child${quotation.children === 1 ? '' : 'ren'}` : ''}`],
        ['Accommodation', quotation.accommodation || 'As agreed'],
        ['Valid until', formatDate(quotation.validity_until)],
        ['Currency', currency],
    ];
    tripLines.forEach(([label, value], index) => {
        doc.font('Helvetica-Bold').text(`${label}: `, 310, topY + 14 + index * 13, { continued: true });
        doc.font('Helvetica').text(String(value));
    });
    doc.y = Math.max(doc.y, topY + 105);
    doc.moveDown(0.8);
    if (quotation.product_name) {
        sectionTitle(doc, 'Safari / experience');
        doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(quotation.product_name);
        doc.moveDown(0.5);
    }
    if (quotation.itinerary) {
        sectionTitle(doc, 'Proposed itinerary');
        doc.font('Helvetica').fontSize(9).fillColor(INK).text(quotation.itinerary, { lineGap: 3 });
        doc.moveDown(0.8);
    }
    sectionTitle(doc, 'Cost breakdown');
    const tableX = 48;
    const colWidths = [265, 55, 85, 94];
    const rowTop = doc.y;
    doc.rect(tableX, rowTop, 499, 22).fill(FOREST);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    doc.text('DESCRIPTION', tableX + 8, rowTop + 7, { width: colWidths[0] - 12 });
    doc.text('QTY', tableX + colWidths[0], rowTop + 7, { width: colWidths[1] - 8, align: 'right' });
    doc.text('UNIT', tableX + colWidths[0] + colWidths[1], rowTop + 7, { width: colWidths[2] - 8, align: 'right' });
    doc.text('TOTAL', tableX + colWidths[0] + colWidths[1] + colWidths[2], rowTop + 7, { width: colWidths[3] - 8, align: 'right' });
    doc.y = rowTop + 22;
    items.forEach((item, index) => {
        const descriptionHeight = doc.heightOfString(String(item.description), { width: colWidths[0] - 12, lineGap: 2 });
        const rowHeight = Math.max(24, descriptionHeight + 12);
        ensureSpace(doc, rowHeight + 10);
        const y = doc.y;
        if (index % 2 === 0)
            doc.rect(tableX, y, 499, rowHeight).fill('#f7f4ec');
        doc.fillColor(INK).font('Helvetica').fontSize(8.5);
        doc.text(String(item.description), tableX + 8, y + 6, { width: colWidths[0] - 12 });
        doc.text(String(Number(item.quantity)), tableX + colWidths[0], y + 6, { width: colWidths[1] - 8, align: 'right' });
        doc.text(amount(item.unitPrice, currency), tableX + colWidths[0] + colWidths[1], y + 6, {
            width: colWidths[2] - 8,
            align: 'right',
        });
        doc.font('Helvetica-Bold').text(amount(item.totalPrice, currency), tableX + colWidths[0] + colWidths[1] + colWidths[2], y + 6, {
            width: colWidths[3] - 8,
            align: 'right',
        });
        doc.y = y + rowHeight;
        doc.strokeColor('#e5e0d5').lineWidth(0.5).moveTo(tableX, doc.y).lineTo(tableX + 499, doc.y).stroke();
    });
    ensureSpace(doc, 110);
    const totalsY = doc.y + 12;
    const totalsX = 330;
    const totalsRows = [
        ['Subtotal', amount(quotation.subtotal, currency)],
        ['Discount', `- ${amount(quotation.discount_amount, currency)}`],
        [`Tax (${Number(quotation.tax_rate)}%)`, amount(quotation.tax_amount, currency)],
        ['TOTAL', amount(quotation.total, currency), true],
    ];
    totalsRows.forEach(([label, value, emphasis], index) => {
        const y = totalsY + index * 19;
        if (emphasis) {
            doc.rect(totalsX - 8, y - 3, 225, 24).fill(FOREST);
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
        }
        else {
            doc.fillColor(MUTED).font('Helvetica').fontSize(9);
        }
        doc.text(label, totalsX, y + 2, { width: 120 });
        doc.text(value, totalsX + 120, y + 2, { width: 90, align: 'right' });
    });
    doc.y = totalsY + 92;
    if (quotation.special_arrangements) {
        sectionTitle(doc, 'Special arrangements');
        doc.font('Helvetica').fontSize(9).fillColor(INK).text(quotation.special_arrangements, { lineGap: 2 });
        doc.moveDown(0.7);
    }
    sectionTitle(doc, 'Payment terms');
    doc.font('Helvetica').fontSize(9).fillColor(INK).text(quotation.payment_terms || settings.billing.defaultPaymentTerms, { lineGap: 2 });
    if (settings.billing.bankDetails) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(8.5).text('Bank details');
        doc.font('Helvetica').fontSize(9).text(settings.billing.bankDetails, { lineGap: 2 });
    }
    if (quotation.notes) {
        doc.moveDown(0.7);
        sectionTitle(doc, 'Notes');
        doc.font('Helvetica').fontSize(9).fillColor(INK).text(quotation.notes, { lineGap: 2 });
    }
    doc.moveDown(1.2);
    doc
        .fillColor(FOREST)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Thank you for travelling with Erniza Africa Safaris.', { align: 'left' });
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('Karibu Tanzania - travel with purpose.');
    companyFooter(doc, settings.company, settings.billing);
    doc.end();
}
export async function renderInvoicePdfToBuffer(id) {
    const db = getDb();
    const result = await db.query(`SELECT i.*, c.first_name, c.last_name, c.email, c.phone, c.country, c.reference AS customer_reference,
            b.reference AS booking_reference, b.travel_date_start, b.travel_date_end
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       LEFT JOIN bookings b ON b.id = i.booking_id
      WHERE i.id = $1`, [id]);
    const invoice = result.rows[0];
    if (!invoice)
        throw notFound('Invoice not found');
    const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order, created_at', [id]);
    const settings = await getSettings();
    const currency = invoice.currency;
    return await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: `Invoice ${invoice.reference}`, Author: settings.company.name } });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        drawHeader(doc, settings.company, 'INVOICE', `${invoice.reference}  |  Issued ${formatDate(invoice.issue_date)}`);
        const topY = doc.y;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('BILL TO', 48, topY);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(`${invoice.first_name} ${invoice.last_name}`, 48, topY + 13);
        doc.font('Helvetica').fontSize(9).fillColor(INK);
        [invoice.customer_reference, invoice.email, invoice.phone, invoice.country].filter(Boolean).forEach((line, index) => {
            doc.text(String(line), 48, topY + 29 + index * 13);
        });
        doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('INVOICE DETAILS', 310, topY);
        doc.font('Helvetica').fontSize(9).fillColor(INK);
        [
            ['Status', String(invoice.status).toUpperCase()],
            ['Issue date', formatDate(invoice.issue_date)],
            ['Due date', formatDate(invoice.due_date)],
            ['Booking', invoice.booking_reference || '—'],
            ['Currency', currency],
        ].forEach(([label, value], index) => {
            doc.font('Helvetica-Bold').text(`${label}: `, 310, topY + 14 + index * 13, { continued: true });
            doc.font('Helvetica').text(String(value));
        });
        doc.y = Math.max(doc.y, topY + 100);
        doc.moveDown(0.8);
        sectionTitle(doc, 'Line items');
        const tableX = 48;
        const colWidths = [265, 55, 85, 94];
        const rowTop = doc.y;
        doc.rect(tableX, rowTop, 499, 22).fill(FOREST);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
        doc.text('DESCRIPTION', tableX + 8, rowTop + 7, { width: colWidths[0] - 12 });
        doc.text('QTY', tableX + colWidths[0], rowTop + 7, { width: colWidths[1] - 8, align: 'right' });
        doc.text('UNIT', tableX + colWidths[0] + colWidths[1], rowTop + 7, { width: colWidths[2] - 8, align: 'right' });
        doc.text('TOTAL', tableX + colWidths[0] + colWidths[1] + colWidths[2], rowTop + 7, { width: colWidths[3] - 8, align: 'right' });
        doc.y = rowTop + 22;
        items.rows.forEach((item, index) => {
            const descriptionHeight = doc.heightOfString(String(item.description), { width: colWidths[0] - 12, lineGap: 2 });
            const rowHeight = Math.max(24, descriptionHeight + 12);
            ensureSpace(doc, rowHeight + 10);
            const y = doc.y;
            if (index % 2 === 0)
                doc.rect(tableX, y, 499, rowHeight).fill('#f7f4ec');
            doc.fillColor(INK).font('Helvetica').fontSize(8.5);
            doc.text(String(item.description), tableX + 8, y + 6, { width: colWidths[0] - 12 });
            doc.text(String(Number(item.quantity)), tableX + colWidths[0], y + 6, { width: colWidths[1] - 8, align: 'right' });
            doc.text(amount(item.unit_price, currency), tableX + colWidths[0] + colWidths[1], y + 6, { width: colWidths[2] - 8, align: 'right' });
            doc.font('Helvetica-Bold').text(amount(item.total_price, currency), tableX + colWidths[0] + colWidths[1] + colWidths[2], y + 6, { width: colWidths[3] - 8, align: 'right' });
            doc.y = y + rowHeight;
            doc.strokeColor('#e5e0d5').lineWidth(0.5).moveTo(tableX, doc.y).lineTo(tableX + 499, doc.y).stroke();
        });
        ensureSpace(doc, 110);
        const totalsY = doc.y + 12;
        const totalsX = 330;
        const totalsRows = [
            ['Subtotal', amount(invoice.subtotal, currency)],
            [`Tax (${Number(invoice.tax_rate)}%)`, amount(invoice.tax_amount, currency)],
            ['TOTAL', amount(invoice.total, currency), true],
            ['Amount paid', amount(invoice.amount_paid, currency)],
            ['Balance due', amount(invoice.balance, currency)],
        ];
        totalsRows.forEach(([label, value, emphasis], index) => {
            const y = totalsY + index * 19;
            if (emphasis) {
                doc.rect(totalsX - 8, y - 3, 225, 24).fill(FOREST);
                doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
            }
            else {
                doc.fillColor(MUTED).font('Helvetica').fontSize(9);
            }
            doc.text(label, totalsX, y + 2, { width: 120 });
            doc.text(value, totalsX + 120, y + 2, { width: 90, align: 'right' });
        });
        doc.y = totalsY + totalsRows.length * 19 + 12;
        if (invoice.payment_terms) {
            sectionTitle(doc, 'Payment terms');
            doc.font('Helvetica').fontSize(9).fillColor(INK).text(invoice.payment_terms, { lineGap: 2 });
            doc.moveDown(0.5);
        }
        if (settings.billing.bankDetails) {
            doc.font('Helvetica-Bold').fontSize(8.5).text('Bank details');
            doc.font('Helvetica').fontSize(9).text(settings.billing.bankDetails, { lineGap: 2 });
            doc.moveDown(0.5);
        }
        if (invoice.notes) {
            sectionTitle(doc, 'Notes');
            doc.font('Helvetica').fontSize(9).fillColor(INK).text(invoice.notes, { lineGap: 2 });
        }
        doc.moveDown(1.2);
        doc.fillColor(FOREST).font('Helvetica-Bold').fontSize(9).text('Thank you for your business.', { align: 'left' });
        doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('Erniza Africa Safaris - Karibu Tanzania.');
        companyFooter(doc, settings.company, settings.billing);
        doc.end();
    });
}
export async function renderInvoicePdf(id, res) {
    const buffer = await renderInvoicePdfToBuffer(id);
    const db = getDb();
    const result = await db.query('SELECT reference FROM invoices WHERE id = $1', [id]);
    const reference = result.rows[0]?.reference ?? 'invoice';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${reference}.pdf"`);
    res.send(buffer);
}
export async function renderReceiptPdf(paymentId, res) {
    const db = getDb();
    const result = await db.query(`SELECT pay.*, b.reference AS booking_reference, b.total_amount, b.currency AS booking_currency,
            b.travel_date_start, b.travel_date_end,
            c.first_name, c.last_name, c.email, c.phone, c.country, c.reference AS customer_reference,
            u.full_name AS recorded_by_name,
            COALESCE((SELECT sum(CASE WHEN p2.type='refund' THEN -p2.amount ELSE p2.amount END) FROM payments p2 WHERE p2.booking_id = b.id), 0)
            + COALESCE((SELECT sum(a.amount) FROM payment_adjustments a WHERE a.booking_id = b.id), 0) AS total_paid
       FROM payments pay
       JOIN bookings b ON b.id = pay.booking_id
       JOIN customers c ON c.id = pay.customer_id
       LEFT JOIN admin_users u ON u.id = pay.recorded_by
      WHERE pay.id = $1`, [paymentId]);
    const payment = result.rows[0];
    if (!payment)
        throw notFound('Payment not found');
    const settings = await getSettings();
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: `Receipt ${payment.receipt_number}`, Author: settings.company.name } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${payment.receipt_number}.pdf"`);
    doc.pipe(res);
    const isRefund = payment.type === 'refund';
    drawHeader(doc, settings.company, isRefund ? 'REFUND VOUCHER' : 'PAYMENT RECEIPT', `${payment.receipt_number}  |  ${formatDate(payment.paid_at)}`);
    const topY = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('RECEIVED FROM', 48, topY);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(`${payment.first_name} ${payment.last_name}`, 48, topY + 13);
    doc.font('Helvetica').fontSize(9);
    [payment.email, payment.phone, payment.country].filter(Boolean).forEach((line, index) => {
        doc.text(String(line), 48, topY + 29 + index * 13);
    });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('BOOKING', 310, topY);
    doc.font('Helvetica').fontSize(9).fillColor(INK);
    [
        ['Booking reference', payment.booking_reference],
        ['Travel dates', `${formatDate(payment.travel_date_start)} - ${formatDate(payment.travel_date_end)}`],
        ['Payment method', payment.method.replace(/_/g, ' ')],
        ['Reference', payment.external_reference || '—'],
        ['Recorded by', payment.recorded_by_name || '—'],
    ].forEach(([label, value], index) => {
        doc.font('Helvetica-Bold').text(`${label}: `, 310, topY + 14 + index * 13, { continued: true });
        doc.font('Helvetica').text(String(value));
    });
    doc.y = Math.max(doc.y, topY + 100);
    doc.moveDown(1);
    doc.rect(48, doc.y, 499, 74).fill(isRefund ? '#f7e8e4' : CREAM).stroke('#e5e0d5');
    doc
        .fillColor(isRefund ? '#9b2c2c' : FOREST)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(isRefund ? 'REFUND AMOUNT' : 'AMOUNT RECEIVED', 70, doc.y + 14);
    doc.fontSize(24).fillColor(INK).text(amount(payment.amount, payment.currency), 70, doc.y + 14);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Currency: ${payment.currency}`, 360, doc.y + 17);
    doc.y += 92;
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    doc.text(`Booking total: ${amount(payment.total_amount, payment.booking_currency)}`, 48, doc.y);
    doc.text(`Total paid to date: ${amount(payment.total_paid, payment.booking_currency)}`, 48, doc.y + 15);
    const balance = Number(payment.total_amount) - Number(payment.total_paid);
    doc
        .font('Helvetica-Bold')
        .fillColor(balance <= 0 ? FOREST : '#9b2c2c')
        .text(`Outstanding balance: ${amount(balance, payment.booking_currency)}`, 48, doc.y + 30);
    doc.moveDown(2);
    if (payment.notes) {
        sectionTitle(doc, 'Notes');
        doc.font('Helvetica').fontSize(9).fillColor(INK).text(payment.notes, 48, doc.y, { width: 499, lineGap: 2 });
    }
    doc.moveDown(2);
    doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(MUTED)
        .text('This is a computer-generated receipt issued by Erniza Africa Safaris. Payment records are immutable; corrections are recorded as auditable adjustments.', 48, doc.y, { width: 499, lineGap: 2 });
    doc.moveDown(0.6);
    doc.text(`Generated ${formatDateTime(new Date())} (Africa/Dar_es_Salaam)`, { width: 499 });
    companyFooter(doc, settings.company, settings.billing);
    doc.end();
}
