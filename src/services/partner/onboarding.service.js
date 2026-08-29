import { ApprovalStatus, PartnerCapability, StoreStatus, StoreStatusApproval } from '../../config/constants.js';
import { sequelize } from '../../models/index.js';
import { storeRepository } from '../../repositories/shared/store.repository.js';
import { userRepository } from '../../repositories/shared/user.repository.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/AppError.js';
import { canonicalStateName, stateOfCity } from '../../utils/indiaLocations.js';

/**
 * Partner onboarding — PRODUCT_CONTEXT.md §3.
 *
 * Signup used to ask "what kind of business are you?" and hand back one of
 * five business types, each of which unlocked a different dashboard. It
 * now asks the only question that changes anything: **what do you want to
 * offer?** — supplies, services, or both. That answer sets two booleans,
 * and the single partner dashboard adapts around them.
 *
 * Business type survives on the KYC form, where it belongs: it tells staff
 * what paperwork to expect from a clinic versus an individual. It no
 * longer decides navigation, so it is no longer asked before the partner
 * has even named their business.
 */

/** Statuses whose KYC is still the partner's to (re)submit. Once it is in the queue, it stops being self-serve; a REJECTED partner is fixing their submission, so they get it back. */
const KYC_EDITABLE_STATUSES = [StoreStatus.PENDING_KYC, StoreStatus.REJECTED];

const CAPABILITY_COLUMN = Object.freeze({
  [PartnerCapability.PRODUCTS]: 'offersProducts',
  [PartnerCapability.SERVICES]: 'offersServices',
});

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Appends -2, -3, … until the slug is free. Skips the store's own row so resubmitting the same name doesn't collide with itself. */
async function uniqueSlug(name, storeId, transaction) {
  const base = slugify(name) || 'petza-partner';
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const clash = await storeRepository.findBySlug(candidate, { transaction });
    if (!clash || clash.id === storeId) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Never return the model — this is the shape petza-partner's onboarding
 * screens and its dashboard header both read.
 */
function toOnboardingDto(store) {
  if (!store) {
    return {
      storeId: null,
      businessType: null,
      offersProducts: false,
      offersServices: false,
      approvalStatus: ApprovalStatus.PENDING,
      status: null,
      name: null,
      ownerName: null,
      address: null,
      city: null,
      isVerified: false,
      kycSubmittedAt: null,
    };
  }

  return {
    storeId: store.id,
    businessType: store.businessType,
    offersProducts: store.offersProducts,
    offersServices: store.offersServices,
    approvalStatus: StoreStatusApproval[store.status],
    status: store.status,
    name: store.name,
    ownerName: store.ownerName,
    address: store.address,
    city: store.city,
    isVerified: store.isVerified ?? false,
    kycSubmittedAt: store.kycSubmittedAt,
    ...(store.status === StoreStatus.REJECTED && store.rejectionReason ? { rejectionReason: store.rejectionReason } : {}),
  };
}

export const partnerOnboardingService = {
  /** Where the partner is in onboarding — lets the app resume mid-flow after a reinstall instead of restarting at the first screen. */
  async getOnboarding(userId) {
    const store = await storeRepository.findByOwnerUserId(userId);
    return toOnboardingDto(store);
  },

  /**
   * The signup capability screen's submit — "What do you want to offer on
   * Petza?" — and the thing that creates the partner's one store row.
   *
   * Idempotent: submitting the same set twice is a no-op, so a retry after
   * a dropped response never creates a second store.
   *
   * Additive, exactly like the later "grow your business" flow: a partner
   * who comes back through here can only turn capabilities on. Nothing
   * takes one away, because doing so would orphan live bookings and
   * in-flight orders (§3).
   */
  async selectCapabilities({ userId, capabilities }) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('Account no longer exists');

    const changes = {};
    for (const capability of capabilities) changes[CAPABILITY_COLUMN[capability]] = true;

    const existing = await storeRepository.findByOwnerUserId(userId);
    if (existing) {
      const alreadySet = Object.entries(changes).every(([column]) => existing[column]);
      if (alreadySet) return toOnboardingDto(existing);
      return toOnboardingDto(await storeRepository.update(existing, changes));
    }

    const store = await sequelize.transaction(async (transaction) => {
      const created = await storeRepository.create(
        {
          ownerUserId: userId,
          ...changes,
          status: StoreStatus.PENDING_KYC,
          email: user.email,
          phone: user.phone,
        },
        { transaction }
      );
      // Linked back onto the user so every later partner request can read
      // `req.user.partnerStoreId` straight off the token.
      await userRepository.update(user, { partnerStoreId: created.id }, { transaction });
      return created;
    });

    return toOnboardingDto(store);
  },

  /**
   * The KYC form's submit — names the business, records what shape it is,
   * stores the uploaded documents, and opens the dashboard.
   *
   * One form for every partner now. There used to be five, one per
   * business type, each writing to its own profile table; the fields that
   * genuinely differ between a clinic and a groomer turned out to be
   * per-*listing* facts, and those live in a listing's dynamic
   * `attributes` (§4), where admin can add to them without a migration.
   *
   * Submitting takes the store straight to ACTIVE rather than into a
   * review queue. Petza gates the risky thing — listing under a
   * `requires_verification` category like Medicines or Veterinary needs an
   * approved document (§4) — rather than holding every partner's whole
   * account behind a manual review before they can so much as see their
   * dashboard. Admin can still suspend, and `isVerified` (the public tick)
   * stays a separate, staff-set flag.
   */
  async submitKyc(userId, payload) {
    const store = await storeRepository.findByOwnerUserId(userId);
    if (!store) throw new BadRequestError('Choose what you want to offer on Petza before submitting your details');

    if (store.status === StoreStatus.SUSPENDED) throw new ConflictError('This account is suspended. Contact support.');
    if (!KYC_EDITABLE_STATUSES.includes(store.status)) {
      throw new ConflictError('Your details have already been submitted');
    }

    const submittedAt = new Date();

    const updated = await sequelize.transaction(async (transaction) => {
      const slug = await uniqueSlug(payload.businessName, store.id, transaction);

      const next = await storeRepository.update(
        store,
        {
          name: payload.businessName,
          slug,
          businessType: payload.businessType,
          ownerName: payload.ownerName,
          address: payload.address ?? null,
          city: payload.city,
          // Derived from the city when the KYC form didn't carry one: every
          // listing this store owns is labelled and filtered from these
          // columns (see `locationOf` and the catalogue's `state=` filter),
          // so a blank state here used to hide the whole shop from anyone
          // browsing the state it is plainly in.
          state: canonicalStateName(payload.state ?? stateOfCity(payload.city)),
          pincode: payload.pincode ?? null,
          status: StoreStatus.ACTIVE,
          kycSubmittedAt: submittedAt,
          // A resubmission after rejection starts clean — leaving the old
          // reason behind would keep the app rendering the rejected copy.
          rejectionReason: null,
          reviewedAt: null,
        },
        { transaction }
      );

      await storeRepository.replaceKycDocuments({
        storeId: store.id,
        documents: payload.documents ?? [],
        transaction,
      });

      return next;
    });

    return {
      approvalStatus: StoreStatusApproval[updated.status],
      submittedAt: submittedAt.toISOString(),
    };
  },

  /** What onboarding/pending.tsx polls. A partner with no store yet is PENDING — they have not finished signing up, not been rejected. */
  async getApprovalStatus(userId) {
    const store = await storeRepository.findByOwnerUserId(userId);
    if (!store) return { approvalStatus: ApprovalStatus.PENDING };

    const approvalStatus = StoreStatusApproval[store.status];
    return {
      approvalStatus,
      ...(approvalStatus === ApprovalStatus.REJECTED && store.rejectionReason
        ? { rejectionReason: store.rejectionReason }
        : {}),
    };
  },
};
