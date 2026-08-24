import { Router } from 'express';

import {
  adjustStock,
  createProduct,
  getOverview,
  getProduct,
  listProducts,
  listStock,
  setProductStatus,
  updateProduct,
} from '../../controllers/partner/supplies.controller.js';
import { requireCapability } from '../../middleware/requireCapability.js';
import { validate } from '../../middleware/validate.js';
import {
  adjustStockSchema,
  createProductSchema,
  listProductsQuerySchema,
  listStockQuerySchema,
  productStatusSchema,
  updateProductSchema,
} from '../../validators/partner/supplies.validator.js';

/**
 * The supplies pillar — catalogue and stock.
 *
 * Every route is behind `requireCapability('SELL_SUPPLIES')`, applied once
 * at the mount below: being a partner is not enough, the store has to
 * actually sell supplies. That middleware also resolves the store, so the
 * controllers read `req.store.id` and a body-supplied storeId can never be
 * trusted (PLATFORM_CONTEXT.md §3's note).
 *
 * Product *orders* are not here — a supplies order is an `orders` row with
 * kind=PRODUCT, which lands with the platform-wide orders surface rather
 * than as a private copy inside this pillar.
 */
export const partnerSuppliesRouter = Router();

partnerSuppliesRouter.use(requireCapability('SELL_SUPPLIES'));

partnerSuppliesRouter.get('/overview', getOverview);

partnerSuppliesRouter.get('/products', validate(listProductsQuerySchema, 'query'), listProducts);
partnerSuppliesRouter.post('/products', validate(createProductSchema), createProduct);
partnerSuppliesRouter.get('/products/:id', getProduct);
partnerSuppliesRouter.patch('/products/:id', validate(updateProductSchema), updateProduct);
partnerSuppliesRouter.patch('/products/:id/status', validate(productStatusSchema), setProductStatus);

partnerSuppliesRouter.get('/inventory', validate(listStockQuerySchema, 'query'), listStock);
partnerSuppliesRouter.patch('/inventory/:variantId', validate(adjustStockSchema), adjustStock);
