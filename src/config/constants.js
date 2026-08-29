/**
 * App-wide enums. Grows as each phase introduces the entities that need
 * them (pet/order/payment status land with those models) — kept minimal
 * until then rather than speculatively listing every enum up front.
 */

export const Context = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  PARTNER: 'PARTNER',
  ADMIN: 'ADMIN',
});

/**
 * Which app an account belongs to, and nothing else. Seat levels
 * (owner/manager/staff) and admin tiers used to live here too; the first
 * were never branched on and the second moved to `AdminRole` below — see
 * migration 20260829000008.
 */
export const Role = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  PARTNER: 'PARTNER',
  ADMIN: 'ADMIN',
});

/**
 * Which slice of the admin console an admin may touch — `users.admin_role`,
 * null for everyone who isn't an ADMIN. SUPER_ADMIN is the only one that
 * can grant it to someone else.
 */
export const AdminRole = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  CATEGORY_MANAGER: 'CATEGORY_MANAGER',
  SUPPORT_AGENT: 'SUPPORT_AGENT',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
});

/** Maps a Role to the JWT `context` it belongs to. One-to-one now, but the indirection is what route guards read. */
export const RoleContext = Object.freeze({
  [Role.CUSTOMER]: Context.CUSTOMER,
  [Role.PARTNER]: Context.PARTNER,
  [Role.ADMIN]: Context.ADMIN,
});

/**
 * The *shape* of a partner's business, for KYC paperwork and admin
 * filtering. Deliberately not what they sell.
 *
 * This used to be KENNEL/VET/TRAINER/GROOMER/SUPPLIER, and it used to
 * decide which of three dashboards a partner landed in. That coupling is
 * gone (PRODUCT_CONTEXT.md §3): there is one partner dashboard, and what
 * varies inside it is the two capability flags on `stores`, not this.
 *
 * A vet clinic that also sells food and a supplies shop that also grooms
 * are both perfectly expressible now — business type says what you *are*,
 * `offersProducts`/`offersServices` say what you *do*, and the second can
 * grow without the first changing.
 */
export const BusinessType = Object.freeze({
  INDIVIDUAL: 'INDIVIDUAL',
  STORE: 'STORE',
  CLINIC: 'CLINIC',
  GROOMER: 'GROOMER',
});

/** Prose forms, so nothing has to un-shout an enum member into a sentence. */
export const BusinessTypeLabel = Object.freeze({
  [BusinessType.INDIVIDUAL]: 'Individual seller',
  [BusinessType.STORE]: 'Store',
  [BusinessType.CLINIC]: 'Clinic',
  [BusinessType.GROOMER]: 'Groomer',
});

/** Lifecycle of a partner's store, from "just picked a business type" to live. */
export const StoreStatus = Object.freeze({
  PENDING_KYC: 'PENDING_KYC',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REJECTED: 'REJECTED',
});

/** The three-state view of StoreStatus the partner app renders (see its `ApprovalStatus` type) — it never sees the finer store lifecycle. */
export const ApprovalStatus = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

/** Collapses the five-state StoreStatus into the partner app's three-state ApprovalStatus. */
export const StoreStatusApproval = Object.freeze({
  [StoreStatus.PENDING_KYC]: ApprovalStatus.PENDING,
  [StoreStatus.UNDER_REVIEW]: ApprovalStatus.PENDING,
  [StoreStatus.ACTIVE]: ApprovalStatus.APPROVED,
  [StoreStatus.REJECTED]: ApprovalStatus.REJECTED,
  [StoreStatus.SUSPENDED]: ApprovalStatus.REJECTED,
});

/**
 * The two things a partner can offer — `stores.offers_products` and
 * `stores.offers_services` (PRODUCT_CONTEXT.md §3). Chosen at signup, and
 * widened later through the "grow your business" flow.
 *
 * Widening only. Turning a capability *off* would orphan live bookings and
 * in-flight orders, so the partner pauses their listings instead; nothing
 * in the API flips either flag back to false.
 */
export const PartnerCapability = Object.freeze({
  PRODUCTS: 'PRODUCTS',
  SERVICES: 'SERVICES',
});

/** Which half of the taxonomy a `categories` row belongs to. */
export const ListingType = Object.freeze({
  PRODUCT: 'PRODUCT',
  SERVICE: 'SERVICE',
});

/** How a `category_attributes` field is answered. The server never sends component names — only the kind of answer it expects. */
export const CategoryAttributeType = Object.freeze({
  SELECT: 'SELECT',
  MULTISELECT: 'MULTISELECT',
  NUMBER: 'NUMBER',
  TEXT: 'TEXT',
  BOOLEAN: 'BOOLEAN',
});

/**
 * The partner's half of whether a listing is live. The admin's half is
 * `ModerationStatus` — a listing reaches customers only when this is
 * ACTIVE *and* that is APPROVED (§8). Neither side can publish alone.
 */
export const ProductListingStatus = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
});

/** Same as ProductListingStatus minus OUT_OF_STOCK — a service doesn't run out, it gets paused. */
export const ServiceListingStatus = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
});

/** The admin's half of the publish gate, on listings and on reviews. */
export const ModerationStatus = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

/** Where a service happens. Decides whether a booking needs a visit address. */
export const ServiceLocationType = Object.freeze({
  AT_STORE: 'AT_STORE',
  HOME_VISIT: 'HOME_VISIT',
});

/** Product order lifecycle (§7). DELIVERED is what writes the EARNING row. */
export const OrderStatus = Object.freeze({
  NEW: 'NEW',
  PACKED: 'PACKED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
});

/**
 * Which status a partner may move an order to from where it is now.
 * Terminal states map to an empty list, which is also what the detail
 * screen reads to decide whether to show the status sheet at all.
 */
export const OrderStatusTransitions = Object.freeze({
  [OrderStatus.NEW]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.CANCELLED]: [],
});

/** Service booking lifecycle (§7). COMPLETED is what writes the EARNING row. */
export const BookingStatus = Object.freeze({
  UPCOMING: 'UPCOMING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const BookingStatusTransitions = Object.freeze({
  [BookingStatus.UPCOMING]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
  [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
});

/** Ledger row kind. `amount_in_inr` is always positive; this is what says which way it moves the balance. */
export const WalletTransactionType = Object.freeze({
  EARNING: 'EARNING',
  PAYOUT: 'PAYOUT',
  REFUND: 'REFUND',
});

export const WalletTransactionStatus = Object.freeze({
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

/** What a ledger row came from. Not a foreign key — it points at three different tables. */
export const WalletReferenceType = Object.freeze({
  ORDER: 'ORDER',
  BOOKING: 'BOOKING',
  PAYOUT_REQUEST: 'PAYOUT_REQUEST',
});

export const PayoutMethod = Object.freeze({
  BANK: 'BANK',
  UPI: 'UPI',
});

/** A review always hangs off a transaction that actually happened. */
export const ReviewReferenceType = Object.freeze({
  ORDER: 'ORDER',
  BOOKING: 'BOOKING',
});

/** What a KYC upload is meant to prove. */
export const KycDocType = Object.freeze({
  IDENTITY: 'IDENTITY',
  BUSINESS_LICENSE: 'BUSINESS_LICENSE',
  GST: 'GST',
  CLINIC_REGISTRATION: 'CLINIC_REGISTRATION',
  CERTIFICATION: 'CERTIFICATION',
  OTHER: 'OTHER',
});

export const KycDocStatus = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const BroadcastAudience = Object.freeze({
  ALL: 'ALL',
  PARTNERS: 'PARTNERS',
  CONSUMERS: 'CONSUMERS',
});

/**
 * The kinds of animal a kennel can list. Distinct from `BusinessType`,
 * which is what the *partner* is — this is what the listing is about.
 */
export const PetType = Object.freeze({
  DOG: 'DOG',
  CAT: 'CAT',
  RABBIT: 'RABBIT',
  HAMSTER: 'HAMSTER',
  GUINEA_PIG: 'GUINEA_PIG',
  FISH: 'FISH',
  BIRD: 'BIRD',
});

/**
 * A listing's lifecycle. AVAILABLE on create — the add-pet form does not
 * ask, because a listing being created is by definition available.
 *
 * ARCHIVED rather than DELETE, for the same reason products are never
 * deleted: enquiries and orders point at listings.
 */
/**
 * Sale or rehoming. Independent of WHO listed it — a partner store and an
 * individual can both publish either, so this never stands in for
 * ownership (that is `storeId` vs `individualOwnerId`).
 *
 * Deliberately not derived from price: a ₹0 SALE listing is a real thing
 * (the app shows "No adoption fee" for it), so the two would disagree.
 */
export const PetListingType = Object.freeze({
  SALE: 'SALE',
  ADOPTION: 'ADOPTION',
});

export const PetListingStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  UNAVAILABLE: 'UNAVAILABLE',
  ARCHIVED: 'ARCHIVED',
});

/**
 * Everything discoverable in the customer catalogue. A sold or paused pet
 * stays visible with its real status so discovery is based on location, not
 * availability. ARCHIVED remains private because it is the explicit
 * "remove listing" state.
 */
export const PubliclyVisiblePetStatuses = Object.freeze([
  PetListingStatus.AVAILABLE,
  PetListingStatus.RESERVED,
  PetListingStatus.SOLD,
  PetListingStatus.UNAVAILABLE,
]);

/** Statuses counted by UI that specifically says "Pets Available". */
export const AvailablePetStatuses = Object.freeze([
  PetListingStatus.AVAILABLE,
  PetListingStatus.RESERVED,
]);

/**
 * Which stores the public store directory may show. Deliberately ACTIVE
 * only — a store still in PENDING_KYC/UNDER_REVIEW has not been vetted by
 * Petza staff, and SUSPENDED/REJECTED ones were vetted and refused. The
 * same "approved or invisible" rule the partner app's own gating implies
 * (see StoreStatusApproval above).
 */
export const PubliclyVisibleStoreStatuses = Object.freeze([StoreStatus.ACTIVE]);

export const PetMediaType = Object.freeze({
  PHOTO: 'PHOTO',
  VIDEO: 'VIDEO',
});

/** Display names, so nothing has to un-shout `GUINEA_PIG` into prose on its own. */
export const PetTypeLabel = Object.freeze({
  [PetType.DOG]: 'Dog',
  [PetType.CAT]: 'Cat',
  [PetType.RABBIT]: 'Rabbit',
  [PetType.HAMSTER]: 'Hamster',
  [PetType.GUINEA_PIG]: 'Guinea pig',
  [PetType.FISH]: 'Fish',
  [PetType.BIRD]: 'Bird',
});

/**
 * Which part of the add-pet form a field belongs to.
 *
 * CATEGORY is the only one whose fields differ by pet type — a dog has a
 * breed and a coat, a fish has neither. Everything else is asked of every
 * listing regardless, which is why those fields are stored with a null
 * `pet_type` rather than copied once per animal.
 */
export const PetAttributeSection = Object.freeze({
  INFORMATION: 'INFORMATION',
  HEALTH: 'HEALTH',
  CATEGORY: 'CATEGORY',
  AVAILABILITY: 'AVAILABILITY',
  MEDIA: 'MEDIA',
});

/** Section headings, so the app never hardcodes a label for a section it renders generically. */
export const PetAttributeSectionLabel = Object.freeze({
  [PetAttributeSection.INFORMATION]: 'Common Information',
  [PetAttributeSection.HEALTH]: 'Health Information',
  [PetAttributeSection.CATEGORY]: 'Category Details',
  [PetAttributeSection.AVAILABILITY]: 'Pricing & Availability',
  [PetAttributeSection.MEDIA]: 'Photos & Video',
});

/** One-word forms for the wizard's step rail, where the full headings above don't fit. */
export const PetAttributeSectionShortLabel = Object.freeze({
  [PetAttributeSection.INFORMATION]: 'Information',
  [PetAttributeSection.HEALTH]: 'Health',
  [PetAttributeSection.CATEGORY]: 'Details',
  [PetAttributeSection.AVAILABILITY]: 'Pricing',
  [PetAttributeSection.MEDIA]: 'Photos',
});

/**
 * How a field is rendered. The app maps each of these to one of its own
 * form primitives — the server never sends component names, only the kind
 * of answer it expects, so the two can restyle independently.
 */
export const PetAttributeInputType = Object.freeze({
  TEXT: 'TEXT',
  TEXTAREA: 'TEXTAREA',
  NUMBER: 'NUMBER',
  DATE: 'DATE',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  BOOLEAN: 'BOOLEAN',
  /** A document upload — certificates, registration papers. */
  FILE: 'FILE',
  /** Photos and video for the listing itself, which the app handles differently from a document. */
  MEDIA: 'MEDIA',
});

/**
 * Where a customer conversation stands, from the partner's side of it.
 * Mirrors petza-partner's `EnquiryStatus` union exactly.
 */
export const EnquiryStatus = Object.freeze({
  NEW: 'NEW',
  FOLLOW_UP: 'FOLLOW_UP',
  ACTIVE: 'ACTIVE',
  RESERVED: 'RESERVED',
  CLOSED: 'CLOSED',
});

/** Which side of the conversation sent a message. */
/**
 * Which end of a thread is reading it. A private seller has no store and no
 * partner login — they are a customer account that happens to own the
 * listing — so `/enquiries` serves both ends and every response has to say
 * which one it was built for.
 */
export const EnquiryViewerRole = Object.freeze({
  BUYER: 'BUYER',
  SELLER: 'SELLER',
});

export const MessageSenderType = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  PARTNER: 'PARTNER',
});
