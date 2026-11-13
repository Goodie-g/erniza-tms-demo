export declare const CURRENCIES: {
    readonly USD: {
        readonly code: "USD";
        readonly label: "US Dollar";
        readonly symbol: "$";
        readonly decimals: 2;
    };
    readonly TZS: {
        readonly code: "TZS";
        readonly label: "Tanzanian Shilling";
        readonly symbol: "TSh";
        readonly decimals: 0;
    };
    readonly EUR: {
        readonly code: "EUR";
        readonly label: "Euro";
        readonly symbol: "€";
        readonly decimals: 2;
    };
    readonly GBP: {
        readonly code: "GBP";
        readonly label: "British Pound";
        readonly symbol: "£";
        readonly decimals: 2;
    };
};
export type CurrencyCode = keyof typeof CURRENCIES;
export declare const CURRENCY_CODES: [CurrencyCode, ...CurrencyCode[]];
export declare const ENQUIRY_STATUSES: readonly ["new", "contacted", "follow_up", "quotation_in_progress", "quotation_sent", "converted", "lost"];
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export declare const ENQUIRY_STATUS_META: Record<EnquiryStatus, {
    label: string;
    tone: string;
}>;
export declare const ENQUIRY_SOURCES: readonly ["website", "whatsapp", "email", "phone", "referral", "other"];
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];
export declare const ENQUIRY_SOURCE_META: Record<EnquirySource, {
    label: string;
}>;
export declare const QUOTATION_STATUSES: readonly ["draft", "revised", "sent", "accepted", "rejected", "expired"];
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export declare const QUOTATION_STATUS_META: Record<QuotationStatus, {
    label: string;
    tone: string;
}>;
export declare const BOOKING_STATUSES: readonly ["pending_confirmation", "confirmed", "in_progress", "completed", "cancelled"];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export declare const BOOKING_STATUS_META: Record<BookingStatus, {
    label: string;
    tone: string;
}>;
export declare const PAYMENT_METHODS: readonly ["bank_transfer", "mobile_money", "cash", "card", "other"];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export declare const PAYMENT_METHOD_META: Record<PaymentMethod, {
    label: string;
}>;
export declare const TOUR_STATUSES: readonly ["scheduled", "in_progress", "completed", "cancelled"];
export type TourStatus = (typeof TOUR_STATUSES)[number];
export declare const TOUR_STATUS_META: Record<TourStatus, {
    label: string;
    tone: string;
}>;
export declare const INVOICE_STATUSES: readonly ["draft", "issued", "sent", "paid", "overdue", "cancelled"];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export declare const INVOICE_STATUS_META: Record<InvoiceStatus, {
    label: string;
    tone: string;
}>;
export declare const CONTENT_STATUSES: readonly ["draft", "published", "archived"];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export declare const CONTENT_STATUS_META: Record<ContentStatus, {
    label: string;
    tone: string;
}>;
export declare const PREFERRED_CHANNELS: readonly ["email", "whatsapp", "phone", "other"];
export type PreferredChannel = (typeof PREFERRED_CHANNELS)[number];
export declare const PREFERRED_CHANNEL_META: Record<PreferredChannel, {
    label: string;
}>;
export declare const USER_ROLES: readonly ["owner", "admin", "manager", "staff"];
export type UserRole = (typeof USER_ROLES)[number];
export declare const INTERACTION_TYPES: readonly ["call", "email", "whatsapp", "meeting", "note"];
export type InteractionType = (typeof INTERACTION_TYPES)[number];
export declare const ACCOMMODATION_OPTIONS: readonly ["Budget camping", "Tented camps", "Lodges", "Luxury camps & lodges", "Mixed"];
export declare const PAYMENT_TERMS_PRESETS: readonly ["30% deposit on confirmation, balance 30 days before arrival.", "50% deposit on confirmation, balance on arrival.", "Full payment required on confirmation.", "100% payment 45 days before arrival."];
export declare const TOUR_ASSIGNMENT_ROLES: readonly ["guide", "driver", "vehicle", "coordinator"];
export declare function formatMoney(value: string | number | null | undefined, currency?: string): string;
//# sourceMappingURL=constants.d.ts.map