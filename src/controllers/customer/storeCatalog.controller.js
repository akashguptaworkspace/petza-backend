import { petListingService } from '../../services/partner/petListing.service.js';
import { storeCatalogService } from '../../services/customer/storeCatalog.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/** The public store directory — what petza-app's Stores tab browses. */
export const listStores = asyncHandler(async (req, res) => {
  const { items, meta } = await storeCatalogService.listPublic(req.query);
  sendSuccess(res, { message: 'Stores fetched successfully', data: items, meta });
});

/** Accepts an id or a slug — an in-app tap has the id, a shared link has the slug. */
export const getStore = asyncHandler(async (req, res) => {
  const data = await storeCatalogService.getPublic(req.params.idOrSlug);
  sendSuccess(res, { message: 'Store fetched successfully', data });
});

/**
 * One store's public pet list. Resolves the store first so an unapproved
 * or unknown store 404s here exactly as it does on the detail route —
 * rather than quietly returning an empty list, which reads to the app as
 * "this store has no pets" instead of "there is no such store".
 */
export const getStorePets = asyncHandler(async (req, res) => {
  const store = await storeCatalogService.getPublic(req.params.idOrSlug);
  const data = await petListingService.listPublicByStore(store.id);
  sendSuccess(res, { message: 'Store pets fetched successfully', data });
});
