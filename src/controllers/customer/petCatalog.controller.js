import { petListingService } from '../../services/partner/petListing.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * The public pet catalogue — what petza-app browses.
 *
 * Reads through the same service the partner side uses, because they are
 * the same listings: one write path, one place that decides what a listing
 * *is*, and a separate DTO for what a customer is allowed to see (see
 * `toPublicDto`). A second service reading the same tables would drift.
 */
export const listPets = asyncHandler(async (req, res) => {
  const { items, meta } = await petListingService.listPublic(req.query);
  sendSuccess(res, { message: 'Pets fetched successfully', data: items, meta });
});

/** Accepts an id or a slug — an in-app tap has the id, a shared link has the slug. */
export const getPet = asyncHandler(async (req, res) => {
  const data = await petListingService.getPublic(req.params.idOrSlug);
  sendSuccess(res, { message: 'Pet fetched successfully', data });
});
