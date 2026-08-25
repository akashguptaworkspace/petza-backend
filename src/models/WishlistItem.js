import { DataTypes, Model } from 'sequelize';

/**
 * One saved pet or store in a customer's wishlist.
 *
 * Exactly one of `petListingId` / `storeId` is set per row — see the
 * create-wishlist-items migration for why this is one table with two
 * nullable foreign keys rather than a polymorphic pair or two tables.
 */
export default (sequelize) => {
  class WishlistItem extends Model {
    static associate(db) {
      WishlistItem.belongsTo(db.User, { as: 'user', foreignKey: 'userId' });
      WishlistItem.belongsTo(db.PetListing, { as: 'petListing', foreignKey: 'petListingId' });
      WishlistItem.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
    }
  }

  WishlistItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      /** Set when this row saves a pet; null when it saves a store. */
      petListingId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      /** Set when this row saves a store; null when it saves a pet. */
      storeId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'WishlistItem',
      tableName: 'wishlist_items',
    }
  );

  return WishlistItem;
};
