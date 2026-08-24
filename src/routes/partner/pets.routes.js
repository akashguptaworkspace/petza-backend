import { Router } from 'express';

import { getFormSchema } from '../../controllers/partner/petCatalog.controller.js';
import {
  createListing,
  getListing,
  listListings,
  updateListing,
  updateListingStatus,
  uploadMedia,
} from '../../controllers/partner/petListing.controller.js';
import { requireCapability } from '../../middleware/requireCapability.js';
import { uploadPetMedia } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { formSchemaQuerySchema } from '../../validators/partner/petCatalog.validator.js';
import {
  createPetListingSchema,
  listPetListingsQuerySchema,
  updatePetListingSchema,
  updatePetListingStatusSchema,
} from '../../validators/partner/petListing.validator.js';
import { partnerEnquiriesRouter } from './enquiries.routes.js';

/**
 * The pets pillar — listings, and the form used to create one.
 *
 * Behind `requireCapability('SELL_PETS')`, applied once at the mount below:
 * being a partner is not enough, the store has to actually sell pets. That
 * middleware also resolves the store, so controllers read `req.store.id`
 * and a body-supplied storeId can never be trusted.
 *
 * `/form-schema` is reference data rather than store data — the same
 * response for every kennel — but it stays behind the same gate so the
 * breed catalogue isn't a public endpoint before there's a reason for it
 * to be. Move it to the public router when the customer app needs breeds
 * for its filters.
 *
 * Media is uploaded before the listing exists, one file per call: the app
 * uploads each photo as it is picked, so a failure costs one retry instead
 * of the whole form. `POST /` then references the URLs that came back.
 *
 * `PATCH /:id` is the same wizard, opened again on an existing listing —
 * the app posts the whole answer map and the whole media array on save, so
 * it never has to reconcile a partial edit against what the server already
 * has.
 *
 * `PATCH /:id/status` is the detail screen's status buttons (Mark as Sold,
 * Pause, Relist) — no answers, no media, and restricted to the statuses a
 * partner may set directly (see PartnerSettablePetListingStatuses).
 */
export const partnerPetsRouter = Router();

partnerPetsRouter.use(requireCapability('SELL_PETS'));

partnerPetsRouter.get('/form-schema', validate(formSchemaQuerySchema, 'query'), getFormSchema);

partnerPetsRouter.post('/media', uploadPetMedia.single('file'), uploadMedia);

partnerPetsRouter.get('/', validate(listPetListingsQuerySchema, 'query'), listListings);
partnerPetsRouter.post('/', validate(createPetListingSchema), createListing);

/** The inbox — customer conversations about this store's listings. Before `/:id`, so `/enquiries` is never read as a listing id. */
partnerPetsRouter.use('/enquiries', partnerEnquiriesRouter);

// After the literal routes above, so `/form-schema` is never read as an id.
partnerPetsRouter.get('/:id', getListing);
partnerPetsRouter.patch('/:id', validate(updatePetListingSchema), updateListing);
partnerPetsRouter.patch('/:id/status', validate(updatePetListingStatusSchema), updateListingStatus);
