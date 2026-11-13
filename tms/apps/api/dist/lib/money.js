import { Decimal } from 'decimal.js';
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
export function decimal(value) {
    try {
        const instance = new Decimal(value);
        if (!instance.isFinite())
            throw new Error('not finite');
        return instance;
    }
    catch {
        throw new Error(`Invalid decimal value: ${value}`);
    }
}
export function roundMoney(value) {
    return decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}
export function roundQuantity(value) {
    return decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}
/**
 * The single source of truth for quotation arithmetic. The client may display
 * totals but the server always recalculates before persisting.
 */
export function computeQuotationTotals(items, discountAmount = '0', taxRate = '0') {
    const computedItems = items.map((item) => {
        const quantity = decimal(item.quantity);
        const unitPrice = decimal(item.unitPrice);
        if (quantity.lte(0))
            throw new Error('Quantity must be greater than zero');
        if (unitPrice.lt(0))
            throw new Error('Unit price cannot be negative');
        return {
            description: item.description,
            quantity: quantity.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
            unitPrice: unitPrice.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
            totalPrice: quantity.mul(unitPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
        };
    });
    const subtotal = computedItems.reduce((sum, item) => sum.plus(item.totalPrice), new Decimal(0));
    let discount = decimal(discountAmount);
    if (discount.lt(0))
        discount = new Decimal(0);
    if (discount.gt(subtotal))
        discount = subtotal;
    const rate = decimal(taxRate);
    if (rate.lt(0) || rate.gt(100))
        throw new Error('Tax rate must be between 0 and 100');
    const taxable = subtotal.minus(discount);
    const tax = taxable.mul(rate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return {
        items: computedItems,
        subtotal: subtotal.toFixed(2),
        discountAmount: discount.toFixed(2),
        taxRate: rate.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toFixed(3),
        taxAmount: tax.toFixed(2),
        total: taxable.plus(tax).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    };
}
export function computePaymentTotals(totalAmount, payments, adjustments = []) {
    const total = decimal(totalAmount);
    const paid = payments.reduce((sum, payment) => (payment.type === 'refund' ? sum.minus(payment.amount) : sum.plus(payment.amount)), new Decimal(0));
    const adjusted = adjustments.reduce((sum, adjustment) => sum.plus(adjustment.amount), paid);
    const balance = total.minus(adjusted);
    let status = 'unpaid';
    if (adjusted.gt(total))
        status = 'overpaid';
    else if (adjusted.eq(total) && total.gt(0))
        status = 'paid';
    else if (adjusted.gt(0))
        status = balance.lt(total.times(0.5)) ? 'partial' : 'deposit';
    return {
        paid: adjusted.toFixed(2),
        balance: balance.toFixed(2),
        status,
    };
}
