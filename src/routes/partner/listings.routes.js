import { Router } from 'express';

import {
  createProduct,
  createService,
  deleteProduct,
  deleteService,
  getCategories,
  getProduct,
  getService,
  listProducts,
  listServices,
  setProductStatus,
  setServiceStatus,
  updateProduct,
  updateService,
} from '../../controllers/partner/listing.controller.js';
import { PartnerCapability } from '../../config/constants.js';
import { requireCapability, requireStore } from '../../middleware/requireCapability.js';
import { validate } from '../../middleware/validate.js';
import {
  createProductSchema,
  createServiceSchema,
  listingTypeQuerySchema,
  listProductsQuerySchema,
  listServicesQuerySchema,
  productStatusSchema,
  serviceStatusSchema,
  updateProductSchema,
  updateServiceSchema,
} from '../../validators/partner/listing.validator.js';

/**
 * The Listings tab — PRODUCT_CONTEXT.md §6.
 *
 * One router, two halves, each behind the capability it belongs to. A
 * partner who only sells supplies gets a 403 from `/services`, and their
 * app never shows the segmented control that would let them ask for it in
 * the first place; the middleware is what makes that a rule rather than a
 * UI convention (§10/R15).
 *
 * `/categories` sits in front of both gates on purpose. It is the taxonomy
 * itself — the same rows for every partner — and the "grow your business"
 * flow has to show a partner the service categories *before* they have the
 * services capability, which is precisely the case a gate here would
 * break. It still requires a store, so it is not public.
 */
export const partnerListingsRouter = Router();

partnerListingsRouter.get('/categories', requireStore, validate(listingTypeQuerySchema, 'query'), getCategories);

partnerListingsRouter.get(
  '/products',
  requireCapability(PartnerCapability.PRODUCTS),
  validate(listProductsQuerySchema, 'query'),
  listProducts
);
partnerListingsRouter.post(
  '/products',
  requireCapability(PartnerCapability.PRODUCTS),
  validate(createProductSchema),
  createProduct
);
partnerListingsRouter.get('/products/:id', requireCapability(PartnerCapability.PRODUCTS), getProduct);
partnerListingsRouter.patch(
  '/products/:id',
  requireCapability(PartnerCapability.PRODUCTS),
  validate(updateProductSchema),
  updateProduct
);
// Status is its own route rather than part of the PATCH above because it
// must not send the listing back for moderation — see the service.
partnerListingsRouter.patch(
  '/products/:id/status',
  requireCapability(PartnerCapability.PRODUCTS),
  validate(productStatusSchema),
  setProductStatus
);
partnerListingsRouter.delete('/products/:id', requireCapability(PartnerCapability.PRODUCTS), deleteProduct);

partnerListingsRouter.get(
  '/services',
  requireCapability(PartnerCapability.SERVICES),
  validate(listServicesQuerySchema, 'query'),
  listServices
);
partnerListingsRouter.post(
  '/services',
  requireCapability(PartnerCapability.SERVICES),
  validate(createServiceSchema),
  createService
);
partnerListingsRouter.get('/services/:id', requireCapability(PartnerCapability.SERVICES), getService);
partnerListingsRouter.patch(
  '/services/:id',
  requireCapability(PartnerCapability.SERVICES),
  validate(updateServiceSchema),
  updateService
);
partnerListingsRouter.patch(
  '/services/:id/status',
  requireCapability(PartnerCapability.SERVICES),
  validate(serviceStatusSchema),
  setServiceStatus
);
partnerListingsRouter.delete('/services/:id', requireCapability(PartnerCapability.SERVICES), deleteService);
