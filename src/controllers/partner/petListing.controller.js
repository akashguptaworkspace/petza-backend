import { petMediaUrl } from '../../middleware/upload.js';
import { petListingService } from '../../services/partner/petListing.service.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/** One file per call. The app uploads each photo as it is picked, so a failure costs one retry rather than the whole listing. */
export const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('No file was uploaded');

  sendSuccess(res, {
    statusCode: 201,
    message: 'File uploaded successfully',
    data: { url: petMediaUrl(req.file.filename), size: req.file.size, mimeType: req.file.mimetype },
  });
});

export const createListing = asyncHandler(async (req, res) => {
  const data = await petListingService.create({
    // Never from the body — `requireCapability` resolved this from the token.
    storeId: req.store.id,
    answers: req.body.answers,
    media: req.body.media,
  });

  sendSuccess(res, { statusCode: 201, message: 'Listing published successfully', data });
});

export const listListings = asyncHandler(async (req, res) => {
  const { items, meta } = await petListingService.listForStore({ storeId: req.store.id, ...req.query });
  sendSuccess(res, { message: 'Listings fetched successfully', data: items, meta });
});

export const getListing = asyncHandler(async (req, res) => {
  const data = await petListingService.getForStore({ id: req.params.id, storeId: req.store.id });
  sendSuccess(res, { message: 'Listing fetched successfully', data });
});

export const updateListing = asyncHandler(async (req, res) => {
  const data = await petListingService.update({
    id: req.params.id,
    // Never from the body — `requireCapability` resolved this from the token.
    storeId: req.store.id,
    answers: req.body.answers,
    media: req.body.media,
  });

  sendSuccess(res, { message: 'Listing updated successfully', data });
});

export const updateListingStatus = asyncHandler(async (req, res) => {
  const data = await petListingService.updateStatusForStore({
    id: req.params.id,
    storeId: req.store.id,
    status: req.body.status,
  });

  sendSuccess(res, { message: 'Status updated', data });
});
