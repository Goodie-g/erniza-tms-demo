export const CURRENCIES = {
    USD: { code: 'USD', label: 'US Dollar', symbol: '$', decimals: 2 },
    TZS: { code: 'TZS', label: 'Tanzanian Shilling', symbol: 'TSh', decimals: 0 },
    EUR: { code: 'EUR', label: 'Euro', symbol: '€', decimals: 2 },
    GBP: { code: 'GBP', label: 'British Pound', symbol: '£', decimals: 2 },
};
export const CURRENCY_CODES = Object.keys(CURRENCIES);
export const ENQUIRY_STATUSES = [
    'new',
    'contacted',
    'follow_up',
    'quotation_in_progress',
    'quotation_sent',
    'converted',
    'lost',
];
export const ENQUIRY_STATUS_META = {
    new: { label: 'New', tone: 'blue' },
    contacted: { label: 'Contacted', tone: 'indigo' },
    follow_up: { label: 'Follow-up required', tone: 'amber' },
    quotation_in_progress: { label: 'Quotation in progress', tone: 'purple' },
    quotation_sent: { label: 'Quotation sent', tone: 'cyan' },
    converted: { label: 'Converted', tone: 'green' },
    lost: { label: 'Lost', tone: 'red' },
};
export const ENQUIRY_SOURCES = ['website', 'whatsapp', 'email', 'phone', 'referral', 'other'];
export const ENQUIRY_SOURCE_META = {
    website: { label: 'Website' },
    whatsapp: { label: 'WhatsApp' },
    email: { label: 'Email' },
    phone: { label: 'Phone' },
    referral: { label: 'Referral' },
    other: { label: 'Other' },
};
export const QUOTATION_STATUSES = ['draft', 'revised', 'sent', 'accepted', 'rejected', 'expired'];
export const QUOTATION_STATUS_META = {
    draft: { label: 'Draft', tone: 'slate' },
    revised: { label: 'Revised draft', tone: 'amber' },
    sent: { label: 'Sent', tone: 'blue' },
    accepted: { label: 'Accepted', tone: 'green' },
    rejected: { label: 'Rejected', tone: 'red' },
    expired: { label: 'Expired', tone: 'orange' },
};
export const BOOKING_STATUSES = ['pending_confirmation', 'confirmed', 'in_progress', 'completed', 'cancelled'];
export const BOOKING_STATUS_META = {
    pending_confirmation: { label: 'Pending confirmation', tone: 'amber' },
    confirmed: { label: 'Confirmed', tone: 'green' },
    in_progress: { label: 'In progress', tone: 'blue' },
    completed: { label: 'Completed', tone: 'slate' },
    cancelled: { label: 'Cancelled', tone: 'red' },
};
export const PAYMENT_METHODS = ['bank_transfer', 'mobile_money', 'cash', 'card', 'other'];
export const PAYMENT_METHOD_META = {
    bank_transfer: { label: 'Bank transfer' },
    mobile_money: { label: 'Mobile money' },
    cash: { label: 'Cash' },
    card: { label: 'Card' },
    other: { label: 'Other' },
};
export const TOUR_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];
export const TOUR_STATUS_META = {
    scheduled: { label: 'Scheduled', tone: 'blue' },
    in_progress: { label: 'In progress', tone: 'green' },
    completed: { label: 'Completed', tone: 'slate' },
    cancelled: { label: 'Cancelled', tone: 'red' },
};
export const INVOICE_STATUSES = ['draft', 'issued', 'sent', 'paid', 'overdue', 'cancelled'];
export const INVOICE_STATUS_META = {
    draft: { label: 'Draft', tone: 'slate' },
    issued: { label: 'Issued', tone: 'blue' },
    sent: { label: 'Sent', tone: 'cyan' },
    paid: { label: 'Paid', tone: 'green' },
    overdue: { label: 'Overdue', tone: 'red' },
    cancelled: { label: 'Cancelled', tone: 'amber' },
};
export const CONTENT_STATUSES = ['draft', 'published', 'archived'];
export const CONTENT_STATUS_META = {
    draft: { label: 'Draft', tone: 'slate' },
    published: { label: 'Published', tone: 'green' },
    archived: { label: 'Archived', tone: 'amber' },
};
export const PREFERRED_CHANNELS = ['email', 'whatsapp', 'phone', 'other'];
export const PREFERRED_CHANNEL_META = {
    email: { label: 'Email' },
    whatsapp: { label: 'WhatsApp' },
    phone: { label: 'Phone' },
    other: { label: 'Other' },
};
export const USER_ROLES = ['owner', 'admin', 'manager', 'staff'];
export const INTERACTION_TYPES = ['call', 'email', 'whatsapp', 'meeting', 'note'];
export const ACCOMMODATION_OPTIONS = [
    'Budget camping',
    'Tented camps',
    'Lodges',
    'Luxury camps & lodges',
    'Mixed',
];
export const PAYMENT_TERMS_PRESETS = [
    '30% deposit on confirmation, balance 30 days before arrival.',
    '50% deposit on confirmation, balance on arrival.',
    'Full payment required on confirmation.',
    '100% payment 45 days before arrival.',
];
export const TOUR_ASSIGNMENT_ROLES = ['guide', 'driver', 'vehicle', 'coordinator'];
export function formatMoney(value, currency = 'USD') {
    if (value === null || value === undefined || value === '')
        return '—';
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(numeric))
        return '—';
    const meta = CURRENCIES[currency in CURRENCIES ? currency : 'USD'];
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: meta.code,
            minimumFractionDigits: meta.decimals,
            maximumFractionDigits: meta.decimals,
        }).format(numeric);
    }
    catch {
        return `${meta.symbol} ${numeric.toFixed(meta.decimals)}`;
    }
}
//# sourceMappingURL=constants.js.map