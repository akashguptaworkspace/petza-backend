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

export const Role = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  PARTNER_OWNER: 'PARTNER_OWNER',
  PARTNER_MANAGER: 'PARTNER_MANAGER',
  PARTNER_STAFF: 'PARTNER_STAFF',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
});

/** Maps a granular Role to the JWT `context` it belongs to. */
export const RoleContext = Object.freeze({
  [Role.CUSTOMER]: Context.CUSTOMER,
  [Role.PARTNER_OWNER]: Context.PARTNER,
  [Role.PARTNER_MANAGER]: Context.PARTNER,
  [Role.PARTNER_STAFF]: Context.PARTNER,
  [Role.ADMIN]: Context.ADMIN,
  [Role.SUPER_ADMIN]: Context.ADMIN,
});

/**
 * What a partner actually does on Petza — chosen on the partner app's
 * role screen (`app/signup/role.tsx`) and the thing that decides which
 * dashboard they land in.
 *
 * There is deliberately no PET_SHOP member: a pet shop and a breeder run
 * the same storefront (list pets, take enquiries, sell), so they share the
 * KENNEL type and one set of screens rather than each getting a near-empty
 * duplicate. Mirrors petza-partner's `BusinessType` union exactly.
 *
 * VET, TRAINER and GROOMER are all care providers — they sell slots, so
 * they share the PROVIDE_CARE capability and one set of dashboards, and
 * differ only in wording, KYC proofs and one optional module each. Adding
 * the next one (boarding, day-care, walking) is a member here, a profile
 * table, and a care profile in the app — never a new dashboard.
 *
 * SUPPLIER is a business whose whole trade is supplies — an online pet
 * food and accessories shop that sells no pets and provides no care. A
 * kennel that *also* stocks food is not this: it stays a KENNEL and adds
 * the SELL_SUPPLIES capability. Business type is what you are; capability
 * is what you do.
 */
export const BusinessType = Object.freeze({
  KENNEL: 'KENNEL',
  VET: 'VET',
  TRAINER: 'TRAINER',
  GROOMER: 'GROOMER',
  SUPPLIER: 'SUPPLIER',
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
 * What each business type is allowed to do — derived server-side from the
 * chosen type, never sent by the client. A store's capabilities can be
 * widened later by an admin (§2 "one partner, many capabilities"); this is
 * only the starting set.
 */
export const BusinessTypeCapabilities = Object.freeze({
  [BusinessType.KENNEL]: ['SELL_PETS'],
  [BusinessType.VET]: ['PROVIDE_CARE'],
  [BusinessType.TRAINER]: ['PROVIDE_CARE'],
  [BusinessType.GROOMER]: ['PROVIDE_CARE'],
  [BusinessType.SUPPLIER]: ['SELL_SUPPLIES'],
});

export const StoreCapability = Object.freeze({
  SELL_PETS: 'SELL_PETS',
  SELL_SUPPLIES: 'SELL_SUPPLIES',
  PROVIDE_CARE: 'PROVIDE_CARE',
});

/**
 * A supplies catalogue entry's lifecycle. Products are never deleted —
 * past orders point at them — so retiring one is ARCHIVED, not a DELETE.
 */
export const ProductStatus = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
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
export const PetListingStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  UNAVAILABLE: 'UNAVAILABLE',
  ARCHIVED: 'ARCHIVED',
});

/** What customers can still buy. Anything else is hidden from the public catalogue but stays visible to its owner. */
export const PubliclyVisiblePetStatuses = Object.freeze([
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
export const MessageSenderType = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  PARTNER: 'PARTNER',
});
