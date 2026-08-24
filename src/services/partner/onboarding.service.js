import {
  ApprovalStatus,
  BusinessType,
  BusinessTypeCapabilities,
  StoreStatus,
  StoreStatusApproval,
} from '../../config/constants.js';
import { sequelize } from '../../models/index.js';
import { storeRepository } from '../../repositories/shared/store.repository.js';
import { userRepository } from '../../repositories/shared/user.repository.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/AppError.js';

/**
 * Statuses whose business type is still the partner's to change. Once KYC
 * is in the review queue (or approved), the type is what Petza staff
 * verified the documents against, so it stops being self-serve — a
 * REJECTED partner is fixing their submission, so they get it back.
 */
const TYPE_CHANGEABLE_STATUSES = [StoreStatus.PENDING_KYC, StoreStatus.REJECTED];

/** Business name lives on a different field per business type — the app's KYC forms speak the partner's language, the store row does not. */
const NAME_FIELD = {
  KENNEL: 'kennelName',
  VET: 'clinicName',
  TRAINER: 'businessName',
  GROOMER: 'salonName',
  SUPPLIER: 'storeName',
};

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

/** Maps a store's KYC answers into its profile table's columns. `undefined` stays out so a partial resubmit never blanks a field. */
function profileValuesFor(payload) {
  const toInt = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  switch (payload.role) {
    case BusinessType.KENNEL:
      return {
        yearsActive: toInt(payload.yearsActive),
        registrationNumber: payload.registrationNumber ?? null,
        pincode: payload.pincode ?? null,
        breeds: payload.breeds ?? [],
      };
    case BusinessType.VET:
      return {
        councilRegistrationNumber: payload.councilRegistrationNumber ?? null,
        services: payload.services ?? [],
      };
    case BusinessType.SUPPLIER:
      return {
        gstNumber: payload.gstNumber ?? null,
        warehouseCity: payload.warehouseCity ?? null,
        brandsStocked: payload.brandsStocked ?? [],
        categories: payload.categories ?? [],
        shipsNationwide: payload.shipsNationwide ?? false,
      };
    case BusinessType.GROOMER:
      return {
        experienceYears: toInt(payload.experienceYears),
        isMobile: payload.isMobile ?? false,
        services: payload.services ?? [],
        petTypes: payload.petTypes ?? [],
      };
    case BusinessType.TRAINER:
      return {
        experienceYears: toInt(payload.experienceYears),
        certificationBody: payload.certificationBody ?? null,
        certificationNumber: payload.certificationNumber ?? null,
        baseArea: payload.baseArea ?? null,
        travelRadiusKm: toInt(payload.travelRadiusKm),
        trainingOffered: payload.trainingOffered ?? [],
      };
    default:
      throw new BadRequestError('Unknown business type');
  }
}

/**
 * Never return the model — this is the shape petza-partner's onboarding
 * screens read.
 *
 * It doubles as the partner's "my store" read: GET /partner/onboarding is
 * the only endpoint that returns the store row today, so the dashboards
 * header (name, city, verified tick) is built from this too. That's why
 * `city`/`ownerName`/`isVerified` are here — they are nothing to do with
 * onboarding itself. When a real GET /partner/store lands, that becomes
 * the dashboard's source and these three can go back out.
 */
function toOnboardingDto(store) {
  if (!store) {
    return {
      storeId: null,
      businessType: null,
      capabilities: [],
      approvalStatus: ApprovalStatus.PENDING,
      status: null,
      name: null,
      ownerName: null,
      city: null,
      isVerified: false,
      kycSubmittedAt: null,
    };
  }

  return {
    storeId: store.id,
    businessType: store.businessType,
    capabilities: store.capabilities ?? [],
    approvalStatus: StoreStatusApproval[store.status],
    status: store.status,
    name: store.name,
    ownerName: store.ownerName,
    city: store.city,
    isVerified: store.isVerified ?? false,
    kycSubmittedAt: store.kycSubmittedAt,
    ...(store.status === StoreStatus.REJECTED && store.rejectionReason ? { rejectionReason: store.rejectionReason } : {}),
  };
}

export const partnerOnboardingService = {
  /** Where the partner is in onboarding — lets the app resume mid-flow after a reinstall instead of restarting at the role screen. */
  async getOnboarding(userId) {
    const store = await storeRepository.findByOwnerUserId(userId);
    return toOnboardingDto(store);
  },

  /**
   * The role screen's submit. Creates the partner's one store row (§2:
   * one partner resolves to exactly one `partnerStoreId`) or retypes the
   * existing one, and links it back onto the user so every later partner
   * request can read `req.user.partnerStoreId` from the token.
   *
   * Idempotent: picking the same type twice is a no-op, so a retry after a
   * dropped response never creates a second store.
   */
  async selectBusinessType({ userId, businessType }) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('Account no longer exists');

    const existing = await storeRepository.findByOwnerUserId(userId);

    if (existing) {
      if (existing.businessType === businessType) return toOnboardingDto(existing);

      if (!TYPE_CHANGEABLE_STATUSES.includes(existing.status)) {
        throw new ConflictError(
          'Your business type is locked while your details are being reviewed. Contact support to change it.'
        );
      }

      const updated = await sequelize.transaction(async (transaction) => {
        // The old type's KYC answers describe a business this partner no
        // longer says they run — they cannot carry over to the new one.
        await storeRepository.deleteProfilesExcept({ businessType, storeId: existing.id, transaction });
        return storeRepository.update(
          existing,
          { businessType, capabilities: BusinessTypeCapabilities[businessType] },
          { transaction }
        );
      });

      return toOnboardingDto(updated);
    }

    const store = await sequelize.transaction(async (transaction) => {
      const created = await storeRepository.create(
        {
          ownerUserId: userId,
          businessType,
          capabilities: BusinessTypeCapabilities[businessType],
          status: StoreStatus.PENDING_KYC,
          email: user.email,
          phone: user.phone,
        },
        { transaction }
      );
      await userRepository.update(user, { partnerStoreId: created.id }, { transaction });
      return created;
    });

    return toOnboardingDto(store);
  },

  /**
   * The KYC form's submit — names the business, fills the business type's
   * own profile table, replaces the uploaded documents, and puts the store
   * into the admin review queue.
   *
   * KENNEL is the one exception: a breeder/kennel carries no professional
   * licence to verify (unlike VET's council registration or TRAINER's
   * certification), so its documents are stored but never gated on — the
   * store goes ACTIVE immediately instead of UNDER_REVIEW, and the partner
   * app never shows it the pending-review screen.
   */
  async submitKyc(userId, payload) {
    const store = await storeRepository.findByOwnerUserId(userId);
    if (!store) throw new BadRequestError('Pick what you do on Petza before submitting your details');

    if (store.businessType !== payload.role) {
      throw new BadRequestError(`These details are for a ${payload.role} — your account is registered as a ${store.businessType}`);
    }

    if (store.status === StoreStatus.ACTIVE) throw new ConflictError('Your account is already approved');
    if (store.status === StoreStatus.SUSPENDED) throw new ConflictError('This account is suspended. Contact support.');
    if (store.status === StoreStatus.UNDER_REVIEW) throw new ConflictError('Your details are already under review');

    const name = payload[NAME_FIELD[payload.role]];
    const submittedAt = new Date();

    const updated = await sequelize.transaction(async (transaction) => {
      const slug = await uniqueSlug(name, store.id, transaction);

      const next = await storeRepository.update(
        store,
        {
          name,
          slug,
          ownerName: payload.ownerName,
          city: payload.city,
          status: payload.role === BusinessType.KENNEL ? StoreStatus.ACTIVE : StoreStatus.UNDER_REVIEW,
          kycSubmittedAt: submittedAt,
          // A resubmission after rejection starts clean — leaving the old
          // reason behind would keep the app rendering the rejected copy.
          rejectionReason: null,
          reviewedAt: null,
        },
        { transaction }
      );

      await storeRepository.upsertProfile({
        businessType: payload.role,
        storeId: store.id,
        values: profileValuesFor(payload),
        transaction,
      });

      await storeRepository.replaceKycDocuments({ storeId: store.id, documents: payload.documents, transaction });

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
