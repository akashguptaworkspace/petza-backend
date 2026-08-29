import { petListingService } from '../../services/shared/petListing.service.js';
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
  const { items, meta } = await petListingService.listPublic({
    ...req.query,
    /**
     * Never from the query — a client could otherwise exclude anyone's
     * listings by passing someone else's id. `optionalAuthenticate` put
     * this here from the token, and it is simply absent for a guest, who
     * has no own-listings to hide.
     *
     * This is what stops someone rehoming a pet from being shown their own
     * pet in the Adopt / Rehome feed as though it were one they could take
     * in. Their listing is still visible to everyone else, and still on
     * their own "My Listings" screen.
     */
    excludeOwnerId: req.user?.id,
  });
  sendSuccess(res, { message: 'Pets fetched successfully', data: items, meta });
});

/** Accepts an id or a slug — an in-app tap has the id, a shared link has the slug. */
export const getPet = asyncHandler(async (req, res) => {
  // `req.user` is set by `optionalAuthenticate` and absent for a guest —
  // the service uses it only to skip counting an owner's own view.
  const data = await petListingService.getPublic(req.params.idOrSlug, { viewerId: req.user?.id });
  sendSuccess(res, { message: 'Pet fetched successfully', data });
});
