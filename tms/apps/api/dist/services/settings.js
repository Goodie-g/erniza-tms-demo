import { getDb } from '../db/client.js';
export const DEFAULT_SETTINGS = {
    company: {
        name: 'Erniza Africa Safaris',
        legalName: 'Erniza Africa Safaris',
        email: 'info@ernizaafricasafaris.com',
        phone: '+255 776 749 127',
        whatsapp: '+255 776 749 127',
        address: 'Sanawari',
        city: 'Arusha',
        country: 'Tanzania',
        website: 'https://ernizaafricasafaris.com',
        logoUrl: '',
        registrationNumber: '',
        taxNumber: '',
    },
    billing: {
        defaultCurrency: 'USD',
        defaultTaxRate: '0',
        quotationValidityDays: 14,
        defaultPaymentTerms: '30% deposit on confirmation, balance due 30 days before arrival.',
        bankDetails: 'Bank details will be provided on the quotation.',
        quoteFooter: 'Thank you for choosing Erniza Africa Safaris. Karibu Tanzania!',
    },
    notifications: {
        enquiryEmail: 'info@ernizaafricasafaris.com',
        notifyOnEnquiry: true,
        notifyOnPayment: false,
    },
};
export async function getSettings(db = getDb()) {
    const result = await db.query('SELECT key, value FROM settings');
    const merged = structuredClone(DEFAULT_SETTINGS);
    for (const row of result.rows) {
        if (row.key in merged) {
            merged[row.key] = { ...merged[row.key], ...row.value };
        }
    }
    return merged;
}
export async function saveSettings(tx, patch, userId) {
    const current = await getSettings(tx);
    for (const [key, value] of Object.entries(patch)) {
        if (!value || !(key in current))
            continue;
        const merged = { ...current[key], ...value };
        await tx.query(`INSERT INTO settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [key, JSON.stringify(merged), userId]);
    }
    return getSettings(tx);
}
