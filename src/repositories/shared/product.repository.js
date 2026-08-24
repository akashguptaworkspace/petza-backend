import { Op } from 'sequelize';

import db from '../../models/index.js';

const { Product, ProductVariant } = db;

/** Variants always come back in picker order, so no caller has to sort them. */
const VARIANT_INCLUDE = { model: ProductVariant, as: 'variants' };
const VARIANT_ORDER = [[{ model: ProductVariant, as: 'variants' }, 'position', 'ASC']];

/** Only place `products` / `product_variants` are queried. Every method is store-scoped — there is no way to read another store's catalogue through it. */
export const productRepository = {
  findAndCountForStore({ storeId, status, categorySlug, search, limit, offset }) {
    const where = { storeId };
    if (status) where.status = status;
    if (categorySlug) where.categorySlug = categorySlug;
    if (search) {
      where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { brand: { [Op.like]: `%${search}%` } }];
    }

    return Product.findAndCountAll({
      where,
      include: [VARIANT_INCLUDE],
      order: [['createdAt', 'DESC'], ...VARIANT_ORDER],
      limit,
      offset,
      // Without this, the include turns one product with three variants
      // into three rows and `count` stops meaning "products".
      distinct: true,
    });
  },

  findByIdForStore({ id, storeId }) {
    return Product.findOne({ where: { id, storeId }, include: [VARIANT_INCLUDE], order: VARIANT_ORDER });
  },

  findBySlug(slug, options) {
    return Product.findOne({ where: { slug }, ...options });
  },

  create(payload, options) {
    return Product.create(payload, options);
  },

  update(product, payload, options) {
    return product.update(payload, options);
  },

  countByStatus(storeId) {
    return Product.findAll({
      where: { storeId },
      attributes: ['status', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true,
    });
  },

  createVariants(rows, options) {
    return ProductVariant.bulkCreate(rows, options);
  },

  findVariantForStore({ variantId, storeId }) {
    return ProductVariant.findOne({
      where: { id: variantId },
      // The join is the authorization: a variant of another store's
      // product simply isn't found.
      include: [{ model: Product, as: 'product', where: { storeId }, required: true }],
    });
  },

  updateVariant(variant, payload, options) {
    return variant.update(payload, options);
  },

  deleteVariantsForProduct(productId, options) {
    return ProductVariant.destroy({ where: { productId }, ...options });
  },

  /**
   * Stock levels across the store, worst first — the inventory screen reads
   * exactly this. `mode` narrows to what needs attention: everything at or
   * under its own threshold, or only what has actually run out.
   */
  findStockForStore({ storeId, mode, limit, offset }) {
    const stockWhere = { isActive: true };
    if (mode === 'OUT') stockWhere.stockQuantity = { [Op.lte]: 0 };
    if (mode === 'LOW') stockWhere.stockQuantity = { [Op.lte]: db.sequelize.col('ProductVariant.low_stock_threshold') };

    return ProductVariant.findAndCountAll({
      where: stockWhere,
      include: [
        {
          model: Product,
          as: 'product',
          where: { storeId, status: { [Op.ne]: 'ARCHIVED' } },
          required: true,
        },
      ],
      order: [['stockQuantity', 'ASC']],
      limit,
      offset,
    });
  },

  /** How many live variants are out of stock, and how many are merely low — the two numbers the supplies dashboard leads with. */
  async countStockAlerts(storeId) {
    const rows = await ProductVariant.findAll({
      where: { isActive: true },
      include: [{ model: Product, as: 'product', where: { storeId, status: 'ACTIVE' }, required: true, attributes: [] }],
      attributes: ['stockQuantity', 'lowStockThreshold'],
      raw: true,
    });

    return rows.reduce(
      (counts, row) => {
        if (row.stockQuantity <= 0) counts.outOfStock += 1;
        else if (row.stockQuantity <= row.lowStockThreshold) counts.lowStock += 1;
        counts.stockUnits += row.stockQuantity;
        return counts;
      },
      { outOfStock: 0, lowStock: 0, stockUnits: 0 }
    );
  },
};
