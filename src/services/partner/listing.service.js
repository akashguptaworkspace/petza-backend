import {
  CategoryAttributeType,
  KycDocStatus,
  ListingType,
  ModerationStatus,
  ProductListingStatus,
  ServiceListingStatus,
} from '../../config/constants.js';
import db, { sequelize } from '../../models/index.js';
import { categoryRepository } from '../../repositories/shared/category.repository.js';
import { listingRepository } from '../../repositories/shared/listing.repository.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';

const { StoreKycDocument } = db;

/**
 * Everything a partner sells — PRODUCT_CONTEXT.md §7.
 *
 * Two rules live here and nowhere else, because both have to hold no
 * matter which screen or which listing kind is asking:
 *
 * 1. **Attributes are validated against the database**, not against a
 *    hardcoded shape. A listing's dynamic fields come from its category's
 *    `category_attributes` rows, so what counts as valid changes the
 *    moment admin edits the taxonomy — with no release on either side.
 *
 * 2. **A gated category needs proof.** Medicines, Supplements & vitamins
 *    and Veterinary carry `requiresVerification`; a listing under one
 *    cannot go ACTIVE until the store has an approved KYC document (§4).
 *    Drafting one is fine — the gate is on publishing, not on authoring.
 */

/** Publishing is what the verification gate and the moderation reset both hang off. */
const PUBLISHING_STATUSES = [ProductListingStatus.ACTIVE, ServiceListingStatus.ACTIVE];

/**
 * Validates and normalises the dynamic answers for one category.
 *
 * Returns a fresh object rather than mutating the payload, and keeps only
 * keys the category actually declares — a client sending an extra field
 * (a stale app after admin removed one) gets it dropped rather than
 * persisted into a blob nothing will ever read again.
 */
function buildAttributes(category, submitted = {}) {
  const declared = category.attributes ?? [];
  const result = {};

  for (const attribute of declared) {
    const raw = submitted[attribute.attributeKey];
    const isEmpty = raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0);

    if (isEmpty) {
      if (attribute.isRequired) throw new BadRequestError(`${attribute.attributeName} is required`);
      continue;
    }

    const allowed = (attribute.options ?? []).map((option) => option.value);

    switch (attribute.attributeType) {
      case CategoryAttributeType.SELECT: {
        if (!allowed.includes(raw)) {
          throw new BadRequestError(`${attribute.attributeName} must be one of: ${allowed.join(', ')}`);
        }
        result[attribute.attributeKey] = raw;
        break;
      }
      case CategoryAttributeType.MULTISELECT: {
        if (!Array.isArray(raw)) throw new BadRequestError(`${attribute.attributeName} must be a list`);
        const invalid = raw.filter((value) => !allowed.includes(value));
        if (invalid.length) {
          throw new BadRequestError(`${attribute.attributeName} has unknown values: ${invalid.join(', ')}`);
        }
        // De-duplicated so a client double-tapping an option can't store
        // the same value twice.
        result[attribute.attributeKey] = [...new Set(raw)];
        break;
      }
      case CategoryAttributeType.NUMBER: {
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) throw new BadRequestError(`${attribute.attributeName} must be a number`);
        result[attribute.attributeKey] = parsed;
        break;
      }
      case CategoryAttributeType.BOOLEAN: {
        result[attribute.attributeKey] = Boolean(raw);
        break;
      }
      default: {
        result[attribute.attributeKey] = String(raw);
      }
    }
  }

  return result;
}

/** Loads a category and refuses one of the wrong kind — a product listing filed under "Grooming" would be invisible to every screen that reads it. */
async function loadCategory(categoryId, expectedType) {
  const category = await categoryRepository.findByIdWithAttributes(categoryId);
  if (!category || !category.isActive) throw new BadRequestError('That category is not available');
  if (category.listingType !== expectedType) {
    throw new BadRequestError(`That category cannot be used for a ${expectedType.toLowerCase()} listing`);
  }
  return category;
}

/**
 * The `requiresVerification` gate (§4). Checked against the categories a
 * listing actually uses — for a product that is its tag as well as its
 * root, since it is the tag (Medicines) that carries the flag.
 */
async function assertVerifiedFor(storeId, categories) {
  const gated = categories.filter((category) => category?.requiresVerification);
  if (!gated.length) return;

  const approved = await StoreKycDocument.count({ where: { storeId, status: KycDocStatus.APPROVED } });
  if (approved === 0) {
    throw new ForbiddenError(
      `${gated[0].name} listings need a verified licence. Upload your documents under Business details and we'll review them.`
    );
  }
}

/**
 * Any edit that changes what customers would see sends the listing back
 * for moderation. Without this a partner could publish an approved listing
 * and then rewrite it into something else, which is exactly the hole the
 * two-part gate exists to close (§8).
 */
const MODERATION_RESET = {
  moderationStatus: ModerationStatus.PENDING,
  moderationNote: null,
  moderatedBy: null,
  moderatedAt: null,
};

export const partnerListingService = {
  /**
   * The taxonomy the add-listing wizard renders — the whole reason no
   * category list is hardcoded in either app (§10).
   */
  async getCategories(listingType) {
    const roots = await categoryRepository.findTree(listingType);
    return roots.map(toCategoryDto);
  },

  // ---------------------------------------------------------------- products

  async listProducts({ storeId, status, tagId, search, page = 1, limit = 20 }) {
    const { rows, count } = await listingRepository.findAndCountProducts({
      storeId,
      status,
      tagId,
      search,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: rows.map(toProductDto),
      page,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      totalItems: count,
    };
  },

  async getProduct({ storeId, id }) {
    const listing = await listingRepository.findProductById({ id, storeId });
    if (!listing) throw new NotFoundError('Listing not found');
    return toProductDto(listing);
  },

  async createProduct({ storeId, payload }) {
    const tag = await loadCategory(payload.tagId, ListingType.PRODUCT);
    // The tag's parent is the root the listing files under. A tag with no
    // parent is itself a root, which is legal — the taxonomy is allowed to
    // grow a flat product category later.
    const rootId = tag.parentId ?? tag.id;

    if (PUBLISHING_STATUSES.includes(payload.status)) await assertVerifiedFor(storeId, [tag]);

    const listing = await listingRepository.createProduct({
      storeId,
      categoryId: rootId,
      tagId: tag.id,
      name: payload.name,
      description: payload.description ?? null,
      priceInInr: payload.priceInInr,
      mrpInInr: payload.mrpInInr ?? null,
      stockQuantity: payload.stockQuantity ?? 0,
      sku: payload.sku ?? null,
      images: payload.images ?? [],
      attributes: buildAttributes(tag, payload.attributes),
      status: payload.status ?? ProductListingStatus.DRAFT,
    });

    return this.getProduct({ storeId, id: listing.id });
  },

  async updateProduct({ storeId, id, payload }) {
    const listing = await listingRepository.findProductById({ id, storeId });
    if (!listing) throw new NotFoundError('Listing not found');

    // Re-resolved even when the tag is unchanged: admin may have edited
    // its fields since, and the answers have to satisfy the current shape.
    const tag = await loadCategory(payload.tagId ?? listing.tagId, ListingType.PRODUCT);
    const nextStatus = payload.status ?? listing.status;

    if (PUBLISHING_STATUSES.includes(nextStatus)) await assertVerifiedFor(storeId, [tag]);

    await listingRepository.update(listing, {
      categoryId: tag.parentId ?? tag.id,
      tagId: tag.id,
      name: payload.name ?? listing.name,
      description: payload.description ?? listing.description,
      priceInInr: payload.priceInInr ?? listing.priceInInr,
      mrpInInr: payload.mrpInInr ?? listing.mrpInInr,
      stockQuantity: payload.stockQuantity ?? listing.stockQuantity,
      sku: payload.sku ?? listing.sku,
      images: payload.images ?? listing.images,
      attributes: buildAttributes(tag, payload.attributes ?? listing.attributes),
      status: nextStatus,
      ...MODERATION_RESET,
    });

    return this.getProduct({ storeId, id });
  },

  /**
   * The status action sheet. Separate from `updateProduct` because it must
   * *not* reset moderation — pausing an approved listing and switching it
   * back on again is not a content change, and forcing it through review
   * each time would make the pause button unusable.
   */
  async setProductStatus({ storeId, id, status }) {
    const listing = await listingRepository.findProductById({ id, storeId });
    if (!listing) throw new NotFoundError('Listing not found');

    if (status === ProductListingStatus.ACTIVE) {
      if (!listing.images?.length) throw new BadRequestError('Add at least one photo before going live');
      if (listing.stockQuantity <= 0) throw new BadRequestError('Add stock before going live');
      await assertVerifiedFor(storeId, [listing.tag, listing.category]);
    }

    await listingRepository.update(listing, { status });
    return this.getProduct({ storeId, id });
  },

  async deleteProduct({ storeId, id }) {
    const listing = await listingRepository.findProductById({ id, storeId });
    if (!listing) throw new NotFoundError('Listing not found');

    // Past orders point at this row, and the foreign key is RESTRICT, so a
    // sold listing is archived by pausing rather than deleted.
    const soldCount = await db.OrderItem.count({ where: { productListingId: id } });
    if (soldCount > 0) {
      throw new BadRequestError('This listing has orders against it. Pause it instead of deleting.');
    }

    await listingRepository.destroy(listing);
    return { id };
  },

  // ---------------------------------------------------------------- services

  async listServices({ storeId, status, categoryId, search, page = 1, limit = 20 }) {
    const { rows, count } = await listingRepository.findAndCountServices({
      storeId,
      status,
      categoryId,
      search,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: rows.map(toServiceDto),
      page,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      totalItems: count,
    };
  },

  async getService({ storeId, id }) {
    const listing = await listingRepository.findServiceById({ id, storeId });
    if (!listing) throw new NotFoundError('Listing not found');
    return toServiceDto(listing);
  },

  async createService({ storeId, payload }) {
    const category = await loadCategory(payload.categoryId, ListingType.SERVICE);
    if (PUBLISHING_STATUSES.includes(payload.status)) await assertVerifiedFor(storeId, [category]);

    const listing = await sequelize.transaction(async (transaction) => {
      const created = await listingRepository.createService(
        {
          storeId,
          categoryId: category.id,
          name: payload.name,
          description: payload.description ?? null,
          durationMinutes: payload.durationMinutes,
          priceInInr: payload.priceInInr,
          locationType: payload.locationType,
          images: payload.images ?? [],
          attributes: buildAttributes(category, payload.attributes),
          status: payload.status ?? ServiceListingStatus.DRAFT,
        },
        { transaction }
      );

      await listingRepository.replaceAvailability({
        serviceListingId: created.id,
        slots: payload.availability ?? [],
        transaction,
      });

      return created;
    });

    return this.getService({ storeId, id: listing.id });
  },

  async updateService({ storeId, id, payload }) {
    const listing = await listingRepository.findServiceById({ id, storeId });
    if (!listing) throw new NotFoundError('Listing not found');

    const category = await loadCategory(payload.categoryId ?? listing.categoryId, ListingType.SERVICE);
    const nextStatus = payload.status ?? listing.status;

    if (PUBLISHING_STATUSES.includes(nextStatus)) await assertVerifiedFor(storeId, [category]);

    await sequelize.transaction(async (transaction) => {
      await listingRepository.update(
        listing,
        {
          categoryId: category.id,
          name: payload.name ?? listing.name,
          description: payload.description ?? listing.description,
          durationMinutes: payload.durationMinutes ?? listing.durationMinutes,
          priceInInr: payload.priceInInr ?? listing.priceInInr,
          locationType: payload.locationType ?? listing.locationType,
          images: payload.images ?? listing.images,
          attributes: buildAttributes(category, payload.attributes ?? listing.attributes),
          status: nextStatus,
          ...MODERATION_RESET,
        },
        { transaction }
      );

      // Only replaced when the client actually sent a grid — omitting it
      // means "leave my hours alone", not "I have no hours".
      if (payload.availability) {
        await listingRepository.replaceAvailability({
          serviceListingId: listing.id,
          slots: payload.availability,
          transaction,
        });
      }
    });

    return this.getService({ storeId, id });
  },

  async setServiceStatus({ storeId, id, status }) {
    const listing = await listingRepository.findServiceById({ id, storeId });
    if (!listing) throw new NotFoundError('Listing not found');

    if (status === ServiceListingStatus.ACTIVE) {
      // A bookable service with no hours is a listing customers can look
      // at and never book, which reads as a bug to both sides.
      if (!listing.availability?.length) throw new BadRequestError('Set your availability before going live');
      await assertVerifiedFor(storeId, [listing.category]);
    }

    await listingRepository.update(listing, { status });
    return this.getService({ storeId, id });
  },

  async deleteService({ storeId, id }) {
    const listing = await listingRepository.findServiceById({ id, storeId });
    if (!listing) throw new NotFoundError('Listing not found');

    const bookingCount = await db.Booking.count({ where: { serviceListingId: id } });
    if (bookingCount > 0) {
      throw new BadRequestError('This service has bookings against it. Pause it instead of deleting.');
    }

    await listingRepository.destroy(listing);
    return { id };
  },
};

// ------------------------------------------------------------------- mapping

/** Never return a model — these are the shapes petza-partner's screens read. */
function toCategoryDto(category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    listingType: category.listingType,
    iconKey: category.iconKey,
    requiresVerification: category.requiresVerification,
    attributes: (category.attributes ?? []).map((attribute) => ({
      key: attribute.attributeKey,
      label: attribute.attributeName,
      type: attribute.attributeType,
      options: attribute.options ?? null,
      hint: attribute.hint,
      unit: attribute.unit,
      isRequired: attribute.isRequired,
    })),
    children: (category.children ?? []).map(toCategoryDto),
  };
}

function toProductDto(listing) {
  return {
    id: listing.id,
    kind: 'PRODUCT',
    name: listing.name,
    description: listing.description,
    priceInInr: listing.priceInInr,
    mrpInInr: listing.mrpInInr,
    stockQuantity: listing.stockQuantity,
    sku: listing.sku,
    images: listing.images ?? [],
    attributes: listing.attributes ?? {},
    status: listing.status,
    moderationStatus: listing.moderationStatus,
    moderationNote: listing.moderationNote,
    // Both halves of the publish gate are already on the row, but the app
    // shouldn't have to know the rule to render "Live" — so it is answered
    // here (§8).
    isLive: listing.isPubliclyVisible,
    category: listing.category ? { id: listing.category.id, name: listing.category.name } : null,
    tag: listing.tag ? { id: listing.tag.id, name: listing.tag.name, slug: listing.tag.slug } : null,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}

function toServiceDto(listing) {
  return {
    id: listing.id,
    kind: 'SERVICE',
    name: listing.name,
    description: listing.description,
    durationMinutes: listing.durationMinutes,
    priceInInr: listing.priceInInr,
    locationType: listing.locationType,
    images: listing.images ?? [],
    attributes: listing.attributes ?? {},
    status: listing.status,
    moderationStatus: listing.moderationStatus,
    moderationNote: listing.moderationNote,
    isLive: listing.isPubliclyVisible,
    category: listing.category
      ? { id: listing.category.id, name: listing.category.name, slug: listing.category.slug }
      : null,
    availability: (listing.availability ?? []).map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxBookingsPerSlot: slot.maxBookingsPerSlot,
    })),
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}
