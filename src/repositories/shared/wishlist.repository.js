import db from '../../models/index.js';

const { WishlistItem } = db;

/**
 * Only place `wishlist_items` is queried.
 *
 * Note every method is user-scoped: there is no way to read or mutate
 * another account's wishlist through this repository, so no caller can
 * forget to scope it.
 */
export const wishlistRepository = {
  /**
   * A user's whole wishlist, newest save first — the "Recently added"
   * order the app's toolbar shows as its default sort. Rows only; the
   * pets/stores themselves are loaded by the catalogue services, so a
   * saved listing that is no longer public simply stops resolving instead
   * of being served from a stale join.
   */
  findAllForUser(userId) {
    return WishlistItem.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });
  },

  findPet({ userId, petListingId }) {
    return WishlistItem.findOne({ where: { userId, petListingId } });
  },

  findStore({ userId, storeId }) {
    return WishlistItem.findOne({ where: { userId, storeId } });
  },

  addPet({ userId, petListingId }) {
    return WishlistItem.create({ userId, petListingId });
  },

  addStore({ userId, storeId }) {
    return WishlistItem.create({ userId, storeId });
  },

  removeById(id) {
    return WishlistItem.destroy({ where: { id } });
  },
};
