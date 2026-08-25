import { Router } from 'express';

import {
  createListing,
  getFormSchema,
  getListing,
  listListings,
  updateListing,
  updateListingStatus,
  uploadMedia,
} from '../../controllers/customer/myListing.controller.js';
import { uploadPetMedia } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { formSchemaQuerySchema } from '../../validators/partner/petCatalog.validator.js';
import {
  createMyListingSchema,
  listMyListingsQuerySchema,
  updateMyListingSchema,
  updateMyListingStatusSchema,
} from '../../validators/customer/myListing.validator.js';

/**
 * A customer listing their OWN pet — "Add Pet" in petza-app.
 *
 * Signed-in only, gated at the mount point in `routes/customer/index.js`.
 * Unlike the partner twin of this router there is no `requireCapability`:
 * that middleware resolves a Store and 403s without one, which is exactly
 * what a customer never has. Ownership here is `req.user.id` instead.
 *
 * `/form-schema` serves the same dynamic add-pet form the partner app
 * renders. Its partner-side doc comment anticipated this move ("Move it to
 * the public router when the customer app needs breeds") — it is reference
 * data, identical for everyone, so both surfaces read the one definition
 * in `pet-form-schema.cjs` rather than the customer app hardcoding a
 * second copy of the breed lists.
 *
 * Literal paths are declared before `/:id` so `/form-schema` and `/media`
 * are never read as listing ids.
 */
export const customerListingsRouter = Router();

customerListingsRouter.get('/form-schema', validate(formSchemaQuerySchema, 'query'), getFormSchema);

/** One file per call, same as the partner flow — a failed upload costs one retry, not the whole form. */
customerListingsRouter.post('/media', uploadPetMedia.single('file'), uploadMedia);

customerListingsRouter.get('/', validate(listMyListingsQuerySchema, 'query'), listListings);
customerListingsRouter.post('/', validate(createMyListingSchema), createListing);

customerListingsRouter.get('/:id', getListing);
customerListingsRouter.patch('/:id', validate(updateMyListingSchema), updateListing);
customerListingsRouter.patch('/:id/status', validate(updateMyListingStatusSchema), updateListingStatus);
