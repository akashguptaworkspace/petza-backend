import { PetListingType } from '../../config/constants.js';
import { petMediaUrl } from '../../middleware/upload.js';
import { petCatalogService } from '../../services/partner/petCatalog.service.js';
import { petListingService } from '../../services/partner/petListing.service.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * A customer's own pet listings — "Add Pet" in petza-app.
 *
 * Every handler scopes to `req.user.id`, so a listing is never addressable
 * by another account's id and there is no owner parameter to get wrong —
 * the same shape as the wishlist controller.
 *
 * These reach through to the SAME service the partner side uses. That is
 * deliberate: one function decides what a valid listing is, whoever
 * published it. Only the owner column and the listing type differ, and
 * both are set here from the token, never from the body.
 */

/** The dynamic add-pet form. Identical response to the partner endpoint — it is reference data, not store data. */
export const getFormSchema = asyncHandler(async (req, res) => {
  const data = await petCatalogService.getFormSchema(req.query.petType);
  sendSuccess(res, { message: 'Pet form schema fetched successfully', data });
});

export const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('No file was uploaded');

  sendSuccess(res, {
    statusCode: 201,
    message: 'File uploaded successfully',
    data: { url: petMediaUrl(req.file.filename), size: req.file.size, mimeType: req.file.mimetype },
  });
});

/**
 * `listingType` IS read from the body here, unlike the partner endpoint
 * which pins it to SALE — choosing between selling and rehoming is the
 * whole point of this flow. The validator constrains it to the enum.
 */
export const createListing = asyncHandler(async (req, res) => {
  const data = await petListingService.create({
    individualOwnerId: req.user.id,
    listingType: req.body.listingType ?? PetListingType.SALE,
    location: req.body.location,
    answers: req.body.answers,
    media: req.body.media,
  });

  sendSuccess(res, { statusCode: 201, message: 'Listing published successfully', data });
});

export const listListings = asyncHandler(async (req, res) => {
  const { items, meta } = await petListingService.listForOwner({ individualOwnerId: req.user.id, ...req.query });
  sendSuccess(res, { message: 'Listings fetched successfully', data: items, meta });
});

export const getListing = asyncHandler(async (req, res) => {
  const data = await petListingService.getForOwner({ id: req.params.id, individualOwnerId: req.user.id });
  sendSuccess(res, { message: 'Listing fetched successfully', data });
});

export const updateListing = asyncHandler(async (req, res) => {
  const data = await petListingService.updateForOwner({
    id: req.params.id,
    individualOwnerId: req.user.id,
    // Optional. The service allows SALE → ADOPTION only; omitting it keeps
    // whatever is stored.
    listingType: req.body.listingType,
    location: req.body.location,
    answers: req.body.answers,
    media: req.body.media,
  });
  sendSuccess(res, { message: 'Listing updated successfully', data });
});

export const updateListingStatus = asyncHandler(async (req, res) => {
  const data = await petListingService.updateStatusForOwner({
    id: req.params.id,
    individualOwnerId: req.user.id,
    status: req.body.status,
  });
  sendSuccess(res, { message: 'Listing updated successfully', data });
});
