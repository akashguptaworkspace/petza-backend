import { z } from 'zod';

import { ProductStatus } from '../../config/constants.js';

/** Money is integers everywhere (PLATFORM_CONTEXT.md §10/R8) — no float prices reach the database. */
const priceInInr = z.number().int().min(0).max(10_000_000);

const variantSchema = z.object({
  label: z.string().trim().min(1, 'Every variant needs a label').max(80),
  sku: z.string().trim().max(60).optional(),
  priceInInr,
  mrpInInr: priceInInr.optional(),
  stockQuantity: z.number().int().min(0).max(1_000_000).default(0),
  lowStockThreshold: z.number().int().min(0).max(10_000).default(5),
  isActive: z.boolean().default(true),
});

const productFields = {
  name: z.string().trim().min(1, 'Product name is required').max(160),
  brand: z.string().trim().max(80).optional(),
  categorySlug: z.string().trim().min(1, 'Category is required').max(60),
  petTypes: z.array(z.string().trim().min(1)).max(10).default([]),
  description: z.string().trim().max(4000).optional(),
  imageUrl: z.string().trim().max(2000).optional(),
};

export const createProductSchema = z.object({
  ...productFields,
  // A product with no variant has no price and no stock, so it could never
  // be bought — one variant is the minimum, even for a single-size item.
  variants: z.array(variantSchema).min(1, 'Add at least one variant').max(20),
  status: z.enum([ProductStatus.DRAFT, ProductStatus.ACTIVE]).optional(),
});

export const updateProductSchema = z
  .object({
    name: productFields.name.optional(),
    brand: productFields.brand,
    categorySlug: productFields.categorySlug.optional(),
    petTypes: z.array(z.string().trim().min(1)).max(10).optional(),
    description: productFields.description,
    imageUrl: productFields.imageUrl,
    status: z.enum(Object.values(ProductStatus)).optional(),
    /** Omit to keep the current variants; send the full list to replace them. */
    variants: z.array(variantSchema).min(1).max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const productStatusSchema = z.object({
  status: z.enum(Object.values(ProductStatus)),
});

export const listProductsQuerySchema = z.object({
  status: z.enum(Object.values(ProductStatus)).optional(),
  category: z.string().trim().max(60).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listStockQuerySchema = z.object({
  /** ALL every live variant, LOW only what is at or under its threshold, OUT only what has run out. */
  mode: z.enum(['ALL', 'LOW', 'OUT']).default('ALL'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const adjustStockSchema = z
  .object({
    /** Relative move — a delivery arrived (+12), a unit broke (-1). */
    delta: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    /** Absolute set — the result of a stock count. */
    stockQuantity: z.number().int().min(0).max(1_000_000).optional(),
    lowStockThreshold: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((data) => data.delta !== undefined || data.stockQuantity !== undefined || data.lowStockThreshold !== undefined, {
    message: 'Send a delta, a stockQuantity, or a lowStockThreshold',
  })
  .refine((data) => !(data.delta !== undefined && data.stockQuantity !== undefined), {
    message: 'Send either a delta or a stockQuantity, not both',
  });
