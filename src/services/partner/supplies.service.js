import { ProductStatus } from '../../config/constants.js';
import { sequelize } from '../../models/index.js';
import { productRepository } from '../../repositories/shared/product.repository.js';
import { buildPaginationMeta } from '../../shared/pagination/paginate.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

/** Appends -2, -3, … until free. Skips the product's own row so renaming back to an existing name doesn't collide with itself. */
async function uniqueSlug(name, productId, transaction) {
  const base = slugify(name) || 'product';
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const clash = await productRepository.findBySlug(candidate, { transaction });
    if (!clash || clash.id === productId) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** Models never go over the wire — this is the shape petza-partner's supplies screens read. */
function toVariantDto(variant) {
  return {
    id: variant.id,
    label: variant.label,
    sku: variant.sku,
    priceInInr: variant.priceInInr,
    mrpInInr: variant.mrpInInr,
    stockQuantity: variant.stockQuantity,
    lowStockThreshold: variant.lowStockThreshold,
    isActive: variant.isActive,
    /** Derived, not stored — one definition of "low", shared by every screen. */
    stockState: stockStateOf(variant),
  };
}

function stockStateOf(variant) {
  if (variant.stockQuantity <= 0) return 'OUT_OF_STOCK';
  if (variant.stockQuantity <= variant.lowStockThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function toProductDto(product) {
  const variants = (product.variants ?? []).map(toVariantDto);
  const prices = variants.map((variant) => variant.priceInInr);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    categorySlug: product.categorySlug,
    petTypes: product.petTypes ?? [],
    description: product.description,
    imageUrl: product.imageUrl,
    status: product.status,
    variants,
    // Precomputed here so a list row never has to reduce over variants to
    // render its price and stock summary.
    priceFromInInr: prices.length ? Math.min(...prices) : 0,
    totalStock: variants.reduce((total, variant) => total + variant.stockQuantity, 0),
    variantCount: variants.length,
  };
}

/** One inventory row: a variant flattened with the product it belongs to. Requires the `product` association to be loaded. */
function toInventoryDto(variant) {
  return {
    variantId: variant.id,
    productId: variant.product.id,
    productName: variant.product.name,
    imageUrl: variant.product.imageUrl,
    label: variant.label,
    sku: variant.sku,
    priceInInr: variant.priceInInr,
    stockQuantity: variant.stockQuantity,
    lowStockThreshold: variant.lowStockThreshold,
    stockState: stockStateOf(variant),
  };
}

/** Variants arrive as the full list the partner sees, so a save replaces the set rather than diffing it. */
function variantRows(variants, productId) {
  return variants.map((variant, index) => ({
    productId,
    label: variant.label,
    sku: variant.sku ?? null,
    priceInInr: variant.priceInInr,
    mrpInInr: variant.mrpInInr ?? null,
    stockQuantity: variant.stockQuantity ?? 0,
    lowStockThreshold: variant.lowStockThreshold ?? 5,
    isActive: variant.isActive ?? true,
    position: index,
  }));
}

export const partnerSuppliesService = {
  /** The supplies dashboard's headline numbers. */
  async getOverview(storeId) {
    const [statusCounts, stockAlerts] = await Promise.all([
      productRepository.countByStatus(storeId),
      productRepository.countStockAlerts(storeId),
    ]);

    const byStatus = Object.fromEntries(statusCounts.map((row) => [row.status, Number(row.count)]));

    return {
      activeProducts: byStatus[ProductStatus.ACTIVE] ?? 0,
      draftProducts: byStatus[ProductStatus.DRAFT] ?? 0,
      archivedProducts: byStatus[ProductStatus.ARCHIVED] ?? 0,
      lowStockCount: stockAlerts.lowStock,
      outOfStockCount: stockAlerts.outOfStock,
      stockUnits: stockAlerts.stockUnits,
    };
  },

  async listProducts({ storeId, status, categorySlug, search, page, limit, offset }) {
    const { rows, count } = await productRepository.findAndCountForStore({
      storeId,
      status,
      categorySlug,
      search,
      limit,
      offset,
    });

    return {
      data: rows.map(toProductDto),
      meta: buildPaginationMeta({ page, limit, total: count }),
    };
  },

  async getProduct({ storeId, id }) {
    const product = await productRepository.findByIdForStore({ id, storeId });
    if (!product) throw new NotFoundError('Product not found');
    return toProductDto(product);
  },

  async createProduct({ storeId, payload }) {
    const product = await sequelize.transaction(async (transaction) => {
      const slug = await uniqueSlug(payload.name, null, transaction);

      const created = await productRepository.create(
        {
          storeId,
          name: payload.name,
          slug,
          brand: payload.brand ?? null,
          categorySlug: payload.categorySlug,
          petTypes: payload.petTypes ?? [],
          description: payload.description ?? null,
          imageUrl: payload.imageUrl ?? null,
          status: payload.status ?? ProductStatus.DRAFT,
        },
        { transaction }
      );

      await productRepository.createVariants(variantRows(payload.variants, created.id), { transaction });
      return created;
    });

    return this.getProduct({ storeId, id: product.id });
  },

  /**
   * Partial update. `variants` is all-or-nothing: leaving it out keeps the
   * existing set, sending it replaces the set wholesale — the app always
   * posts the complete list it is showing, so a partial diff would only
   * invent ways for the two to disagree.
   */
  async updateProduct({ storeId, id, payload }) {
    const product = await productRepository.findByIdForStore({ id, storeId });
    if (!product) throw new NotFoundError('Product not found');

    await sequelize.transaction(async (transaction) => {
      const changes = {};
      for (const field of ['brand', 'categorySlug', 'petTypes', 'description', 'imageUrl', 'status']) {
        if (payload[field] !== undefined) changes[field] = payload[field];
      }
      if (payload.name !== undefined) {
        changes.name = payload.name;
        changes.slug = await uniqueSlug(payload.name, product.id, transaction);
      }

      if (Object.keys(changes).length) await productRepository.update(product, changes, { transaction });

      if (payload.variants) {
        await productRepository.deleteVariantsForProduct(product.id, { transaction });
        await productRepository.createVariants(variantRows(payload.variants, product.id), { transaction });
      }
    });

    return this.getProduct({ storeId, id });
  },

  /** Publishing is the one status change worth its own call — it is what puts a product in front of customers. */
  async setProductStatus({ storeId, id, status }) {
    const product = await productRepository.findByIdForStore({ id, storeId });
    if (!product) throw new NotFoundError('Product not found');

    if (status === ProductStatus.ACTIVE) {
      const sellable = (product.variants ?? []).filter((variant) => variant.isActive);
      if (!sellable.length) throw new BadRequestError('Add at least one active variant before publishing');
    }

    await productRepository.update(product, { status });
    return this.getProduct({ storeId, id });
  },

  /** The inventory screen: every live variant's stock, worst first. */
  async listStock({ storeId, mode, page, limit, offset }) {
    const { rows, count } = await productRepository.findStockForStore({ storeId, mode, limit, offset });

    return {
      data: rows.map(toInventoryDto),
      meta: buildPaginationMeta({ page, limit, total: count }),
    };
  },

  /**
   * Stock correction. `delta` is a relative move (a delivery arrived, a
   * unit broke) and `stockQuantity` is an absolute set (a stock count) —
   * the relative form exists so two people counting at once can't silently
   * overwrite each other's adjustment.
   */
  async adjustStock({ storeId, variantId, delta, stockQuantity, lowStockThreshold }) {
    const variant = await productRepository.findVariantForStore({ variantId, storeId });
    if (!variant) throw new NotFoundError('Variant not found');

    const changes = {};
    if (delta !== undefined) changes.stockQuantity = Math.max(0, variant.stockQuantity + delta);
    if (stockQuantity !== undefined) changes.stockQuantity = stockQuantity;
    if (lowStockThreshold !== undefined) changes.lowStockThreshold = lowStockThreshold;

    if (!Object.keys(changes).length) throw new BadRequestError('Nothing to update');

    const updated = await productRepository.updateVariant(variant, changes);

    // The same row shape the list returns, so a client can drop it straight
    // back into the list it came from.
    return toInventoryDto(updated);
  },
};
