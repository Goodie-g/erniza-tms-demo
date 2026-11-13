import { z } from 'zod';
export declare const optionalText: (max?: number) => z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
export declare const optionalEmail: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
export declare const optionalPhone: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
export declare const dateString: z.ZodString;
export declare const optionalDate: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
export declare const moneyInput: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
export declare const signedMoneyInput: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
export declare const quantityInput: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
export declare const percentInput: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
export declare const uuidSchema: z.ZodString;
export declare const currencySchema: z.ZodEnum<{
    USD: "USD";
    TZS: "TZS";
    EUR: "EUR";
    GBP: "GBP";
}>;
export declare const slugSchema: z.ZodString;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    q: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const passwordResetRequestSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export declare const passwordResetConfirmSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const changePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>;
export declare const customerCreateSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    phone: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    whatsapp: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    country: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    preferredChannel: z.ZodDefault<z.ZodEnum<{
        whatsapp: "whatsapp";
        email: "email";
        phone: "phone";
        other: "other";
    }>>;
    notes: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const customerUpdateSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    phone: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    whatsapp: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    country: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    preferredChannel: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        whatsapp: "whatsapp";
        email: "email";
        phone: "phone";
        other: "other";
    }>>>;
    notes: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
}, z.core.$strip>;
export declare const interactionCreateSchema: z.ZodObject<{
    customerId: z.ZodString;
    enquiryId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    type: z.ZodEnum<{
        whatsapp: "whatsapp";
        email: "email";
        call: "call";
        meeting: "meeting";
        note: "note";
    }>;
    summary: z.ZodString;
    occurredAt: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const enquiryCreateSchema: z.ZodObject<{
    customerId: z.ZodString;
    productId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    source: z.ZodDefault<z.ZodEnum<{
        website: "website";
        whatsapp: "whatsapp";
        email: "email";
        phone: "phone";
        referral: "referral";
        other: "other";
    }>>;
    status: z.ZodDefault<z.ZodEnum<{
        new: "new";
        contacted: "contacted";
        follow_up: "follow_up";
        quotation_in_progress: "quotation_in_progress";
        quotation_sent: "quotation_sent";
        converted: "converted";
        lost: "lost";
    }>>;
    travelDateStart: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    travelDateEnd: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    flexibleDates: z.ZodDefault<z.ZodBoolean>;
    adults: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    children: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    country: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    accommodationPreference: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    budgetAmount: z.ZodPreprocess<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>, unknown>;
    budgetCurrency: z.ZodDefault<z.ZodEnum<{
        USD: "USD";
        TZS: "TZS";
        EUR: "EUR";
        GBP: "GBP";
    }>>;
    specialRequirements: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    internalNotes: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    followUpDate: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const enquiryUpdateSchema: z.ZodObject<{
    customerId: z.ZodOptional<z.ZodString>;
    productId: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    source: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        website: "website";
        whatsapp: "whatsapp";
        email: "email";
        phone: "phone";
        referral: "referral";
        other: "other";
    }>>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        new: "new";
        contacted: "contacted";
        follow_up: "follow_up";
        quotation_in_progress: "quotation_in_progress";
        quotation_sent: "quotation_sent";
        converted: "converted";
        lost: "lost";
    }>>>;
    travelDateStart: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    travelDateEnd: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    flexibleDates: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    adults: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    children: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    country: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    accommodationPreference: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    budgetAmount: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>, unknown>>;
    budgetCurrency: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        USD: "USD";
        TZS: "TZS";
        EUR: "EUR";
        GBP: "GBP";
    }>>>;
    specialRequirements: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    internalNotes: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    followUpDate: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    lostReason: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    assignedTo: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const enquiryNoteSchema: z.ZodObject<{
    note: z.ZodString;
}, z.core.$strip>;
export declare const publicEnquirySchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    email: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    phone: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    whatsapp: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    country: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    productId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    productSlug: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    interest: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    travelDateStart: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    travelDate: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    travelDateEnd: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    flexibleDates: z.ZodDefault<z.ZodCoercedBoolean<unknown>>;
    adults: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    children: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    travellers: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    accommodationPreference: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    accommodation: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    budgetAmount: z.ZodPreprocess<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>, unknown>;
    budgetCurrency: z.ZodDefault<z.ZodEnum<{
        USD: "USD";
        TZS: "TZS";
        EUR: "EUR";
        GBP: "GBP";
    }>>;
    budget: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    specialRequirements: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    message: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    consent: z.ZodOptional<z.ZodCoercedBoolean<unknown>>;
    website: z.ZodOptional<z.ZodString>;
    turnstileToken: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const quotationItemSchema: z.ZodObject<{
    id: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    description: z.ZodString;
    quantity: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
    unitPrice: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
}, z.core.$strip>;
export declare const quotationCreateSchema: z.ZodObject<{
    customerId: z.ZodString;
    enquiryId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    primaryProductId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    currency: z.ZodDefault<z.ZodEnum<{
        USD: "USD";
        TZS: "TZS";
        EUR: "EUR";
        GBP: "GBP";
    }>>;
    travelDateStart: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    travelDateEnd: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    adults: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    children: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    accommodation: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    itinerary: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    specialArrangements: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    paymentTerms: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    validityUntil: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    notes: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    discountAmount: z.ZodDefault<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
    taxRate: z.ZodDefault<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
        description: z.ZodString;
        quantity: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
        unitPrice: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const quotationUpdateSchema: z.ZodObject<{
    currency: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        USD: "USD";
        TZS: "TZS";
        EUR: "EUR";
        GBP: "GBP";
    }>>>;
    notes: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    enquiryId: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    travelDateStart: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    travelDateEnd: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    adults: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    children: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    accommodation: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    validityUntil: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    primaryProductId: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    itinerary: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    specialArrangements: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    paymentTerms: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    discountAmount: z.ZodOptional<z.ZodDefault<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>>;
    taxRate: z.ZodOptional<z.ZodDefault<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
        description: z.ZodString;
        quantity: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
        unitPrice: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const quotationAcceptSchema: z.ZodObject<{
    travelDateStart: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    travelDateEnd: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    adults: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    children: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    travellers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        firstName: z.ZodString;
        lastName: z.ZodString;
        email: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
        phone: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
        nationality: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
        passportNumber: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const bookingUpdateSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<{
        pending_confirmation: "pending_confirmation";
        confirmed: "confirmed";
        in_progress: "in_progress";
        completed: "completed";
        cancelled: "cancelled";
    }>>;
    travelDateStart: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    travelDateEnd: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    accommodation: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    itinerary: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    specialRequirements: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    operationalNotes: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    guideName: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    driverName: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    vehicle: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    cancellationReason: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const travellerCreateSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    phone: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    dateOfBirth: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    passportNumber: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    nationality: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    isLead: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const paymentCreateSchema: z.ZodObject<{
    bookingId: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<{
        payment: "payment";
        refund: "refund";
    }>>;
    method: z.ZodEnum<{
        other: "other";
        bank_transfer: "bank_transfer";
        mobile_money: "mobile_money";
        cash: "cash";
        card: "card";
    }>;
    amount: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
    paidAt: z.ZodString;
    externalReference: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    notes: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const adjustmentCreateSchema: z.ZodObject<{
    bookingId: z.ZodString;
    paymentId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    kind: z.ZodDefault<z.ZodEnum<{
        adjustment: "adjustment";
        write_off: "write_off";
        correction: "correction";
    }>>;
    amount: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
    reason: z.ZodString;
}, z.core.$strip>;
export declare const tourCreateSchema: z.ZodObject<{
    bookingId: z.ZodString;
    title: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    departureDate: z.ZodString;
    returnDate: z.ZodString;
    guideName: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    driverName: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    vehicle: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    notes: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const tourUpdateSchema: z.ZodObject<{
    vehicle: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    notes: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    guideName: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    driverName: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    departureDate: z.ZodOptional<z.ZodString>;
    returnDate: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    status: z.ZodOptional<z.ZodEnum<{
        in_progress: "in_progress";
        completed: "completed";
        cancelled: "cancelled";
        scheduled: "scheduled";
    }>>;
}, z.core.$strip>;
export declare const assignmentCreateSchema: z.ZodObject<{
    role: z.ZodEnum<{
        guide: "guide";
        driver: "driver";
        vehicle: "vehicle";
        coordinator: "coordinator";
    }>;
    name: z.ZodString;
    contact: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const itineraryDaySchema: z.ZodObject<{
    dayNumber: z.ZodCoercedNumber<unknown>;
    title: z.ZodString;
    description: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    accommodation: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    meals: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const productCreateSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    categoryId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    summary: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    description: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    highlights: z.ZodDefault<z.ZodArray<z.ZodString>>;
    inclusions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    exclusions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    durationDays: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    durationNights: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    difficulty: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    minTravellers: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    maxTravellers: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    accommodationInfo: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    seoTitle: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    seoDescription: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    status: z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
    }>>;
    featured: z.ZodDefault<z.ZodBoolean>;
    heroImageId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    destinationIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    activityIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    mediaIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    itineraryDays: z.ZodDefault<z.ZodArray<z.ZodObject<{
        dayNumber: z.ZodCoercedNumber<unknown>;
        title: z.ZodString;
        description: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
        accommodation: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
        meals: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const productUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    categoryId: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    summary: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    description: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    highlights: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString>>>;
    inclusions: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString>>>;
    exclusions: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString>>>;
    durationDays: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    durationNights: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    difficulty: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    minTravellers: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    maxTravellers: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    accommodationInfo: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    seoTitle: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    seoDescription: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
    }>>>;
    featured: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    heroImageId: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    destinationIds: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString>>>;
    activityIds: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString>>>;
    mediaIds: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString>>>;
    itineraryDays: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        dayNumber: z.ZodCoercedNumber<unknown>;
        title: z.ZodString;
        description: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
        accommodation: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
        meals: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export declare const destinationCreateSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    region: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    country: z.ZodDefault<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    summary: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    description: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    latitude: z.ZodPreprocess<z.ZodOptional<z.ZodCoercedNumber<unknown>>, unknown>;
    longitude: z.ZodPreprocess<z.ZodOptional<z.ZodCoercedNumber<unknown>>, unknown>;
    bestTime: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    seoTitle: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    seoDescription: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    status: z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
    }>>;
    featured: z.ZodDefault<z.ZodBoolean>;
    heroImageId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const destinationUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    region: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    country: z.ZodOptional<z.ZodDefault<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>>;
    summary: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    description: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    latitude: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodCoercedNumber<unknown>>, unknown>>;
    longitude: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodCoercedNumber<unknown>>, unknown>>;
    bestTime: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    seoTitle: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    seoDescription: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
    }>>>;
    featured: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    heroImageId: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
}, z.core.$strip>;
export declare const activityCreateSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    category: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    summary: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    description: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    status: z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
    }>>;
    imageId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const activityUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    category: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    summary: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    description: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
    }>>>;
    imageId: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
}, z.core.$strip>;
export declare const productCategorySchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    description: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    sortOrder: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const invoiceItemSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    description: z.ZodString;
    quantity: z.ZodDefault<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
    unitPrice: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
}, z.core.$strip>;
export declare const invoiceCreateSchema: z.ZodObject<{
    bookingId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    customerId: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    issueDate: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    dueDate: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    paymentTerms: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    notes: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        description: z.ZodString;
        quantity: z.ZodDefault<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
        unitPrice: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const invoiceUpdateSchema: z.ZodObject<{
    bookingId: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    customerId: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    issueDate: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    dueDate: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    paymentTerms: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    notes: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    items: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        description: z.ZodString;
        quantity: z.ZodDefault<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
        unitPrice: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
    }, z.core.$strip>>>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        sent: "sent";
        cancelled: "cancelled";
        issued: "issued";
        paid: "paid";
        overdue: "overdue";
    }>>;
}, z.core.$strip>;
export declare const pageUpdateSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
    }>>;
    seoTitle: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    seoDescription: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const mediaUpdateSchema: z.ZodObject<{
    altText: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    description: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export declare const settingsUpdateSchema: z.ZodObject<{
    company: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        legalName: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        whatsapp: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        address: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        city: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        country: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        website: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        logoUrl: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        registrationNumber: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        taxNumber: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    }, z.core.$strip>>;
    billing: z.ZodOptional<z.ZodObject<{
        defaultCurrency: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            USD: "USD";
            TZS: "TZS";
            EUR: "EUR";
            GBP: "GBP";
        }>>>;
        defaultTaxRate: z.ZodOptional<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>>;
        quotationValidityDays: z.ZodOptional<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
        defaultPaymentTerms: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        bankDetails: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
        quoteFooter: z.ZodOptional<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    }, z.core.$strip>>;
    notifications: z.ZodOptional<z.ZodObject<{
        enquiryEmail: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        notifyOnEnquiry: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        notifyOnPayment: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
//# sourceMappingURL=schemas.d.ts.map