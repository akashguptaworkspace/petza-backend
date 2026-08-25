import { wishlistService } from '../../services/customer/wishlist.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * The signed-in customer's wishlist. Every handler scopes to `req.user.id`
 * — a wishlist is never addressable by another account's id, so there is
 * no user parameter to get wrong.
 */
export const getWishlist = asyncHandler(async (req, res) => {
  const data = await wishlistService.listForUser(req.user.id);
  sendSuccess(res, { message: 'Wishlist fetched successfully', data });
});

export const togglePet = asyncHandler(async (req, res) => {
  const data = await wishlistService.togglePet({ userId: req.user.id, petListingId: req.params.petId });
  sendSuccess(res, { message: data.isWishlisted ? 'Added to wishlist' : 'Removed from wishlist', data });
});

export const toggleStore = asyncHandler(async (req, res) => {
  const data = await wishlistService.toggleStore({ userId: req.user.id, storeId: req.params.storeId });
  sendSuccess(res, { message: data.isWishlisted ? 'Added to wishlist' : 'Removed from wishlist', data });
});
