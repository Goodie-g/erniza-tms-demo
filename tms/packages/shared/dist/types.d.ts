import { z } from 'zod';
import type { BookingStatus, ContentStatus, CurrencyCode, InvoiceStatus, EnquirySource, EnquiryStatus, PaymentMethod, PreferredChannel, QuotationStatus, TourStatus, UserRole } from './constants.js';
import { activityCreateSchema, assignmentCreateSchema, customerCreateSchema, destinationCreateSchema, enquiryCreateSchema, loginSchema, paymentCreateSchema, productCreateSchema, quotationCreateSchema, tourCreateSchema, travellerCreateSchema } from './schemas.js';
export type LoginInput = z.infer<typeof loginSchema>;
export type CustomerInput = z.infer<typeof customerCreateSchema>;
export type EnquiryInput = z.infer<typeof enquiryCreateSchema>;
export type QuotationInput = z.infer<typeof quotationCreateSchema>;
export type PaymentInput = z.infer<typeof paymentCreateSchema>;
export type ProductInput = z.infer<typeof productCreateSchema>;
export type DestinationInput = z.infer<typeof destinationCreateSchema>;
export type ActivityInput = z.infer<typeof activityCreateSchema>;
export type TourInput = z.infer<typeof tourCreateSchema>;
export type TravellerInput = z.infer<typeof travellerCreateSchema>;
export type AssignmentInput = z.infer<typeof assignmentCreateSchema>;
export interface ApiUser {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    lastLoginAt: string | null;
}
export interface Customer {
    id: string;
    reference: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    country: string | null;
    preferredChannel: PreferredChannel;
    notes: string | null;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
    enquiryCount?: number;
    bookingCount?: number;
    totalPaid?: string;
}
export interface MediaAsset {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    altText: string | null;
    description: string | null;
    url: string;
    createdAt: string;
    usageCount?: number;
}
export interface DestinationSummary {
    id: string;
    name: string;
    slug: string;
    region: string | null;
    status?: ContentStatus;
}
export interface ActivitySummary {
    id: string;
    name: string;
    slug: string;
    category: string | null;
}
export interface ItineraryDay {
    id: string;
    dayNumber: number;
    title: string;
    description: string | null;
    accommodation: string | null;
    meals: string | null;
}
export interface Product {
    id: string;
    name: string;
    slug: string;
    categoryId: string | null;
    categoryName: string | null;
    summary: string | null;
    description: string | null;
    highlights: string[];
    inclusions: string[];
    exclusions: string[];
    durationDays: number;
    durationNights: number;
    difficulty: string | null;
    minTravellers: number;
    maxTravellers: number;
    accommodationInfo: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    status: ContentStatus;
    featured: boolean;
    heroImageId: string | null;
    heroImageUrl: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    destinations?: DestinationSummary[];
    activities?: ActivitySummary[];
    media?: MediaAsset[];
    itineraryDays?: ItineraryDay[];
}
export interface Destination {
    id: string;
    name: string;
    slug: string;
    region: string | null;
    country: string;
    summary: string | null;
    description: string | null;
    latitude: string | null;
    longitude: string | null;
    bestTime: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    status: ContentStatus;
    featured: boolean;
    heroImageId: string | null;
    heroImageUrl: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    products?: Product[];
}
export interface Activity {
    id: string;
    name: string;
    slug: string;
    category: string | null;
    summary: string | null;
    description: string | null;
    status: ContentStatus;
    imageId: string | null;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface EnquirySummary {
    id: string;
    reference: string;
    customerId: string;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    productId: string | null;
    productName: string | null;
    source: EnquirySource;
    status: EnquiryStatus;
    travelDateStart: string | null;
    travelDateEnd: string | null;
    adults: number;
    children: number;
    budgetAmount: string | null;
    budgetCurrency: CurrencyCode;
    followUpDate: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface Enquiry extends EnquirySummary {
    country: string | null;
    flexibleDates: boolean;
    accommodationPreference: string | null;
    specialRequirements: string | null;
    internalNotes: string | null;
    lostReason: string | null;
    convertedAt: string | null;
    notes?: Array<{
        id: string;
        note: string;
        authorName: string | null;
        createdAt: string;
    }>;
    interactions?: CustomerInteraction[];
    quotations?: QuotationSummary[];
    auditLogs?: AuditLog[];
}
export interface CustomerInteraction {
    id: string;
    customerId: string;
    enquiryId: string | null;
    type: string;
    summary: string;
    occurredAt: string;
    authorName: string | null;
    createdAt: string;
}
export interface QuotationItem {
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    totalPrice: string;
    sortOrder: number;
}
export interface QuotationSummary {
    id: string;
    reference: string;
    customerId: string;
    customerName: string;
    enquiryId: string | null;
    enquiryReference: string | null;
    primaryProductId: string | null;
    currency: CurrencyCode;
    status: QuotationStatus;
    currentVersion: number;
    total: string;
    travelDateStart: string | null;
    travelDateEnd: string | null;
    validityUntil: string | null;
    issuedAt: string | null;
    createdAt: string;
}
export interface Quotation extends QuotationSummary {
    adults: number;
    children: number;
    accommodation: string | null;
    itinerary: string | null;
    specialArrangements: string | null;
    paymentTerms: string | null;
    notes: string | null;
    subtotal: string;
    discountAmount: string;
    taxRate: string;
    taxAmount: string;
    items: QuotationItem[];
    versions?: QuotationVersion[];
    bookingId?: string | null;
    customer?: Customer;
}
export interface QuotationVersion {
    id: string;
    quotationId: string;
    versionNumber: number;
    status: string;
    subtotal: string;
    discountAmount: string;
    taxAmount: string;
    total: string;
    currency: CurrencyCode;
    createdAt: string;
    createdByName: string | null;
    snapshot?: Record<string, unknown>;
}
export interface BookingSummary {
    id: string;
    reference: string;
    customerId: string;
    customerName: string;
    productId: string | null;
    productName: string | null;
    quotationId: string;
    quotationReference: string;
    status: BookingStatus;
    travelDateStart: string;
    travelDateEnd: string;
    adults: number;
    children: number;
    currency: CurrencyCode;
    totalAmount: string;
    amountPaid: string;
    balance: string;
    paymentStatus: 'unpaid' | 'deposit' | 'partial' | 'paid' | 'overpaid';
    createdAt: string;
}
export interface Booking extends BookingSummary {
    accommodation: string | null;
    itinerary: string | null;
    specialRequirements: string | null;
    operationalNotes: string | null;
    guideName: string | null;
    driverName: string | null;
    vehicle: string | null;
    cancellationReason: string | null;
    cancelledAt: string | null;
    confirmedAt: string | null;
    snapshot: Record<string, unknown>;
    travellers?: Traveller[];
    payments?: Payment[];
    adjustments?: PaymentAdjustment[];
    tour?: Tour | null;
    customer?: Customer;
    itineraryDays?: Array<{
        id: string;
        dayNumber: number;
        title: string;
        description: string | null;
        accommodation: string | null;
        meals: string | null;
    }>;
}
export interface Traveller {
    id: string;
    bookingId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    dateOfBirth: string | null;
    passportNumber: string | null;
    nationality: string | null;
    isLead: boolean;
}
export interface Payment {
    id: string;
    reference: string;
    receiptNumber: string;
    bookingId: string;
    bookingReference?: string;
    customerName?: string;
    type: 'payment' | 'refund';
    method: PaymentMethod;
    amount: string;
    currency: CurrencyCode;
    paidAt: string;
    externalReference: string | null;
    notes: string | null;
    recordedByName: string | null;
    createdAt: string;
}
export interface PaymentAdjustment {
    id: string;
    bookingId: string;
    paymentId: string | null;
    kind: string;
    amount: string;
    currency: CurrencyCode;
    reason: string;
    createdByName: string | null;
    createdAt: string;
}
export interface Tour {
    id: string;
    reference: string;
    bookingId: string;
    bookingReference?: string;
    customerName?: string;
    title: string;
    status: TourStatus;
    departureDate: string;
    returnDate: string;
    guideName: string | null;
    driverName: string | null;
    vehicle: string | null;
    notes: string | null;
    assignments?: TourAssignment[];
    travellers?: Traveller[];
    createdAt: string;
    updatedAt: string;
}
export interface TourAssignment {
    id: string;
    tourId: string;
    role: string;
    name: string;
    contact: string | null;
    details: Record<string, unknown>;
    createdAt: string;
}
export interface InvoiceItem {
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    totalPrice: string;
    sortOrder: number;
}
export interface Invoice {
    id: string;
    reference: string;
    bookingId: string | null;
    bookingReference: string | null;
    customerId: string;
    customerName: string;
    customerEmail: string | null;
    status: InvoiceStatus;
    currency: CurrencyCode;
    subtotal: string;
    taxRate: string;
    taxAmount: string;
    total: string;
    amountPaid: string;
    balance: string;
    issueDate: string;
    dueDate: string | null;
    paymentTerms: string | null;
    notes: string | null;
    issuedAt: string | null;
    sentAt: string | null;
    paidAt: string | null;
    cancelledAt: string | null;
    cancellationReason: string | null;
    createdAt: string;
    updatedAt: string;
    items: InvoiceItem[];
}
export interface AuditLog {
    id: string;
    actorId: string | null;
    actorEmail: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    changes: Record<string, unknown> | null;
    ip: string | null;
    createdAt: string;
}
export interface WebsitePage {
    id: string;
    slug: string;
    title: string;
    content: Record<string, unknown>;
    status: ContentStatus;
    seoTitle: string | null;
    seoDescription: string | null;
    publishedAt: string | null;
    updatedAt: string;
}
export interface DashboardData {
    stats: {
        totalEnquiries: number;
        newEnquiries: number;
        awaitingFollowUp: number;
        quotationsAwaiting: number;
        confirmedUpcomingBookings: number;
        upcomingTours: number;
        outstandingBalance: string;
        outstandingCurrency: CurrencyCode;
        paymentsReceived: string;
        bookingValue: string;
        conversionRate: number;
    };
    monthly: Array<{
        month: string;
        bookings: number;
        revenue: string;
        received: string;
    }>;
    enquiryStatus: Array<{
        status: EnquiryStatus;
        count: number;
    }>;
    enquirySources: Array<{
        source: EnquirySource;
        count: number;
    }>;
    recentEnquiries: EnquirySummary[];
    upcomingDepartures: BookingSummary[];
    recentActivity: AuditLog[];
}
export interface PagedResult<T> {
    data: T[];
    meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}
//# sourceMappingURL=types.d.ts.map