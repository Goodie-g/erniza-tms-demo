import { z } from 'zod';
import { BOOKING_STATUSES, CONTENT_STATUSES, CURRENCY_CODES, INVOICE_STATUSES, ENQUIRY_SOURCES, ENQUIRY_STATUSES, INTERACTION_TYPES, PAYMENT_METHODS, PREFERRED_CHANNELS, TOUR_ASSIGNMENT_ROLES, TOUR_STATUSES, } from './constants.js';
const emptyToUndefined = (schema) => z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());
export const optionalText = (max = 5000) => emptyToUndefined(z.string().trim().max(max));
export const optionalEmail = emptyToUndefined(z.string().trim().email('Enter a valid email address').max(200));
export const optionalPhone = emptyToUndefined(z.string().trim().min(5).max(40).regex(/^[+0-9()\-\s.]+$/, 'Enter a valid phone number'));
export const dateString = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid date');
export const optionalDate = emptyToUndefined(dateString);
const decimalText = (label, maxDecimals, allowNegative = false) => z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === 'number' ? String(value) : value.trim()))
    .refine((value) => new RegExp(`^${allowNegative ? '-?' : ''}\\d+(\\.\\d{1,${maxDecimals}})?$`).test(value), {
    message: `${label} must be a valid amount`,
});
export const moneyInput = decimalText('Amount', 2);
export const signedMoneyInput = decimalText('Amount', 2, true);
export const quantityInput = decimalText('Quantity', 4);
export const percentInput = decimalText('Percentage', 3);
export const uuidSchema = z.string().uuid('Invalid identifier');
export const currencySchema = z.enum(CURRENCY_CODES);
export const slugSchema = z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');
export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(200).optional(),
});
// ---------------------------------------------------------------- auth
export const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(200),
});
export const passwordResetRequestSchema = z.object({ email: z.string().trim().email() });
export const passwordResetConfirmSchema = z.object({
    token: z.string().min(20).max(500),
    password: z.string().min(10, 'Use at least 10 characters').max(200),
});
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(10).max(200),
});
// ---------------------------------------------------------------- customers
export const customerCreateSchema = z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: optionalEmail,
    phone: optionalPhone,
    whatsapp: optionalPhone,
    country: optionalText(100),
    preferredChannel: z.enum(PREFERRED_CHANNELS).default('email'),
    notes: optionalText(5000),
});
export const customerUpdateSchema = customerCreateSchema.partial();
export const interactionCreateSchema = z.object({
    customerId: uuidSchema,
    enquiryId: emptyToUndefined(uuidSchema),
    type: z.enum(INTERACTION_TYPES),
    summary: z.string().trim().min(2).max(4000),
    occurredAt: emptyToUndefined(z.string().datetime()),
});
// ---------------------------------------------------------------- enquiries
export const enquiryCreateSchema = z.object({
    customerId: uuidSchema,
    productId: emptyToUndefined(uuidSchema),
    source: z.enum(ENQUIRY_SOURCES).default('phone'),
    status: z.enum(ENQUIRY_STATUSES).default('new'),
    travelDateStart: optionalDate,
    travelDateEnd: optionalDate,
    flexibleDates: z.boolean().default(false),
    adults: z.coerce.number().int().min(1).max(100).default(2),
    children: z.coerce.number().int().min(0).max(100).default(0),
    country: optionalText(100),
    accommodationPreference: optionalText(200),
    budgetAmount: emptyToUndefined(moneyInput),
    budgetCurrency: currencySchema.default('USD'),
    specialRequirements: optionalText(5000),
    internalNotes: optionalText(5000),
    followUpDate: optionalDate,
});
export const enquiryUpdateSchema = enquiryCreateSchema.partial().extend({
    lostReason: optionalText(1000),
    assignedTo: emptyToUndefined(uuidSchema),
});
export const enquiryNoteSchema = z.object({ note: z.string().trim().min(1).max(5000) });
const publicEnquiryBase = z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100).optional().default(''),
    email: optionalEmail,
    phone: optionalPhone,
    whatsapp: optionalPhone,
    country: optionalText(100),
    productId: emptyToUndefined(uuidSchema),
    productSlug: emptyToUndefined(slugSchema),
    interest: optionalText(200),
    travelDateStart: optionalDate,
    travelDate: optionalDate,
    travelDateEnd: optionalDate,
    flexibleDates: z.coerce.boolean().default(false),
    adults: z.coerce.number().int().min(1).max(100).default(2),
    children: z.coerce.number().int().min(0).max(100).default(0),
    travellers: optionalText(50),
    accommodationPreference: optionalText(200),
    accommodation: optionalText(200),
    budgetAmount: emptyToUndefined(moneyInput),
    budgetCurrency: currencySchema.default('USD'),
    budget: optionalText(100),
    specialRequirements: optionalText(5000),
    message: optionalText(5000),
    consent: z.coerce.boolean().optional(),
    // Honeypot: real clients never fill this. Non-empty submissions are silently discarded.
    website: z.string().max(500).optional(),
    turnstileToken: optionalText(2048),
});
export const publicEnquirySchema = publicEnquiryBase
    .refine((data) => Boolean(data.email || data.phone || data.whatsapp), {
    message: 'Provide an email address or phone number',
    path: ['email'],
});
// ---------------------------------------------------------------- quotations
export const quotationItemSchema = z.object({
    id: emptyToUndefined(uuidSchema),
    description: z.string().trim().min(1).max(500),
    quantity: quantityInput,
    unitPrice: moneyInput,
});
export const quotationCreateSchema = z.object({
    customerId: uuidSchema,
    enquiryId: emptyToUndefined(uuidSchema),
    primaryProductId: emptyToUndefined(uuidSchema),
    currency: currencySchema.default('USD'),
    travelDateStart: optionalDate,
    travelDateEnd: optionalDate,
    adults: z.coerce.number().int().min(1).max(100).default(2),
    children: z.coerce.number().int().min(0).max(100).default(0),
    accommodation: optionalText(500),
    itinerary: optionalText(20000),
    specialArrangements: optionalText(5000),
    paymentTerms: optionalText(2000),
    validityUntil: optionalDate,
    notes: optionalText(5000),
    discountAmount: moneyInput.default('0'),
    taxRate: percentInput.default('0'),
    items: z.array(quotationItemSchema).max(100).default([]),
});
export const quotationUpdateSchema = quotationCreateSchema.partial().omit({ customerId: true }).extend({
    items: z.array(quotationItemSchema).max(100).optional(),
});
export const quotationAcceptSchema = z.object({
    travelDateStart: optionalDate,
    travelDateEnd: optionalDate,
    adults: z.coerce.number().int().min(1).max(100).optional(),
    children: z.coerce.number().int().min(0).max(100).optional(),
    travellers: z
        .array(z.object({
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        email: optionalEmail,
        phone: optionalPhone,
        nationality: optionalText(100),
        passportNumber: optionalText(100),
    }))
        .max(100)
        .optional(),
});
// ---------------------------------------------------------------- bookings
export const bookingUpdateSchema = z.object({
    status: z.enum(BOOKING_STATUSES).optional(),
    travelDateStart: optionalDate,
    travelDateEnd: optionalDate,
    accommodation: optionalText(500),
    itinerary: optionalText(20000),
    specialRequirements: optionalText(5000),
    operationalNotes: optionalText(5000),
    guideName: optionalText(150),
    driverName: optionalText(150),
    vehicle: optionalText(150),
    cancellationReason: optionalText(2000),
});
export const travellerCreateSchema = z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: optionalEmail,
    phone: optionalPhone,
    dateOfBirth: optionalDate,
    passportNumber: optionalText(100),
    nationality: optionalText(100),
    isLead: z.boolean().default(false),
});
// ---------------------------------------------------------------- payments
export const paymentCreateSchema = z.object({
    bookingId: uuidSchema,
    type: z.enum(['payment', 'refund']).default('payment'),
    method: z.enum(PAYMENT_METHODS),
    amount: moneyInput.refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
    paidAt: dateString,
    externalReference: optionalText(200),
    notes: optionalText(2000),
});
export const adjustmentCreateSchema = z.object({
    bookingId: uuidSchema,
    paymentId: emptyToUndefined(uuidSchema),
    kind: z.enum(['adjustment', 'write_off', 'correction']).default('adjustment'),
    amount: signedMoneyInput.refine((value) => Number(value) !== 0, 'Amount cannot be zero'),
    reason: z.string().trim().min(3).max(2000),
});
// ---------------------------------------------------------------- tours
export const tourCreateSchema = z.object({
    bookingId: uuidSchema,
    title: optionalText(200),
    departureDate: dateString,
    returnDate: dateString,
    guideName: optionalText(150),
    driverName: optionalText(150),
    vehicle: optionalText(150),
    notes: optionalText(5000),
});
export const tourUpdateSchema = tourCreateSchema.partial().omit({ bookingId: true }).extend({
    status: z.enum(TOUR_STATUSES).optional(),
});
export const assignmentCreateSchema = z.object({
    role: z.enum(TOUR_ASSIGNMENT_ROLES),
    name: z.string().trim().min(1).max(150),
    contact: optionalText(150),
    details: z.record(z.string(), z.unknown()).optional(),
});
// ---------------------------------------------------------------- CMS
const stringList = z.array(z.string().trim().min(1).max(1000)).max(60).default([]);
export const itineraryDaySchema = z.object({
    dayNumber: z.coerce.number().int().min(1).max(365),
    title: z.string().trim().min(1).max(200),
    description: optionalText(5000),
    accommodation: optionalText(300),
    meals: optionalText(300),
});
export const productCreateSchema = z.object({
    name: z.string().trim().min(2).max(200),
    slug: emptyToUndefined(slugSchema),
    categoryId: emptyToUndefined(uuidSchema),
    summary: optionalText(1000),
    description: optionalText(20000),
    highlights: stringList,
    inclusions: stringList,
    exclusions: stringList,
    durationDays: z.coerce.number().int().min(1).max(365).default(1),
    durationNights: z.coerce.number().int().min(0).max(365).default(0),
    difficulty: optionalText(100),
    minTravellers: z.coerce.number().int().min(1).max(100).default(1),
    maxTravellers: z.coerce.number().int().min(1).max(200).default(20),
    accommodationInfo: optionalText(5000),
    seoTitle: optionalText(200),
    seoDescription: optionalText(400),
    status: z.enum(CONTENT_STATUSES).default('draft'),
    featured: z.boolean().default(false),
    heroImageId: emptyToUndefined(uuidSchema),
    destinationIds: z.array(uuidSchema).max(50).default([]),
    activityIds: z.array(uuidSchema).max(50).default([]),
    mediaIds: z.array(uuidSchema).max(30).default([]),
    itineraryDays: z.array(itineraryDaySchema).max(365).default([]),
});
export const productUpdateSchema = productCreateSchema.partial();
export const destinationCreateSchema = z.object({
    name: z.string().trim().min(2).max(200),
    slug: emptyToUndefined(slugSchema),
    region: optionalText(120),
    country: optionalText(120).default('Tanzania'),
    summary: optionalText(1000),
    description: optionalText(20000),
    latitude: emptyToUndefined(z.coerce.number().min(-90).max(90)),
    longitude: emptyToUndefined(z.coerce.number().min(-180).max(180)),
    bestTime: optionalText(300),
    seoTitle: optionalText(200),
    seoDescription: optionalText(400),
    status: z.enum(CONTENT_STATUSES).default('draft'),
    featured: z.boolean().default(false),
    heroImageId: emptyToUndefined(uuidSchema),
});
export const destinationUpdateSchema = destinationCreateSchema.partial();
export const activityCreateSchema = z.object({
    name: z.string().trim().min(2).max(200),
    slug: emptyToUndefined(slugSchema),
    category: optionalText(120),
    summary: optionalText(1000),
    description: optionalText(20000),
    status: z.enum(CONTENT_STATUSES).default('draft'),
    imageId: emptyToUndefined(uuidSchema),
});
export const activityUpdateSchema = activityCreateSchema.partial();
export const productCategorySchema = z.object({
    name: z.string().trim().min(2).max(120),
    slug: emptyToUndefined(slugSchema),
    description: optionalText(1000),
    sortOrder: z.coerce.number().int().min(0).default(0),
});
// ---------------------------------------------------------------- invoices
export const invoiceItemSchema = z.object({
    id: emptyToUndefined(uuidSchema).optional(),
    description: z.string().trim().min(1).max(500),
    quantity: moneyInput.default('1'),
    unitPrice: moneyInput,
});
export const invoiceCreateSchema = z.object({
    bookingId: emptyToUndefined(uuidSchema),
    customerId: emptyToUndefined(uuidSchema),
    issueDate: optionalDate,
    dueDate: optionalDate,
    paymentTerms: optionalText(2000),
    notes: optionalText(2000),
    items: z.array(invoiceItemSchema).max(100).default([]),
});
export const invoiceUpdateSchema = invoiceCreateSchema.partial().extend({
    status: z.enum(INVOICE_STATUSES).optional(),
});
export const pageUpdateSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(CONTENT_STATUSES).optional(),
    seoTitle: optionalText(200),
    seoDescription: optionalText(400),
});
export const mediaUpdateSchema = z.object({
    altText: optionalText(300),
    description: optionalText(1000),
});
export const settingsUpdateSchema = z.object({
    company: z
        .object({
        name: z.string().trim().min(1).max(200),
        legalName: optionalText(200),
        email: z.string().trim().email(),
        phone: optionalText(60),
        whatsapp: optionalText(60),
        address: optionalText(300),
        city: optionalText(120),
        country: optionalText(120),
        website: optionalText(300),
        logoUrl: optionalText(500),
        registrationNumber: optionalText(100),
        taxNumber: optionalText(100),
    })
        .partial()
        .optional(),
    billing: z
        .object({
        defaultCurrency: currencySchema.optional(),
        defaultTaxRate: percentInput.optional(),
        quotationValidityDays: z.coerce.number().int().min(1).max(365).optional(),
        defaultPaymentTerms: optionalText(2000),
        bankDetails: optionalText(2000),
        quoteFooter: optionalText(2000),
    })
        .partial()
        .optional(),
    notifications: z
        .object({
        enquiryEmail: z.string().trim().email().optional(),
        notifyOnEnquiry: z.boolean().optional(),
        notifyOnPayment: z.boolean().optional(),
    })
        .partial()
        .optional(),
});
//# sourceMappingURL=schemas.js.map