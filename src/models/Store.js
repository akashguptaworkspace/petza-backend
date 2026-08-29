import { DataTypes, Model } from 'sequelize';

import { BusinessType, StoreStatus } from '../config/constants.js';

/**
 * The one row a partner resolves to. A business is never split across
 * `stores`/`vendors`/`service_providers` peer tables — it is one store row
 * plus two capability flags.
 *
 * Those flags are the whole model now (PRODUCT_CONTEXT.md §3). There used
 * to be a `capabilities` SET and five per-business-type profile tables,
 * and between them they decided which of three separate dashboards a
 * partner landed in. All of it is gone: there is one partner dashboard,
 * and `offersProducts` / `offersServices` decide what appears inside it.
 *
 * Created the moment the partner says what they want to offer, which is
 * *before* they have told us the business name — so `name` and `slug`
 * stay null until KYC submits them.
 */
export default (sequelize) => {
  class Store extends Model {
    static associate(db) {
      Store.belongsTo(db.User, { as: 'owner', foreignKey: 'ownerUserId' });
      Store.hasMany(db.StoreKycDocument, { as: 'kycDocuments', foreignKey: 'storeId' });
      Store.hasMany(db.ProductListing, { as: 'productListings', foreignKey: 'storeId' });
      Store.hasMany(db.ServiceListing, { as: 'serviceListings', foreignKey: 'storeId' });
      Store.hasMany(db.Order, { as: 'orders', foreignKey: 'storeId' });
      Store.hasMany(db.Booking, { as: 'bookings', foreignKey: 'storeId' });
      Store.hasMany(db.WalletTransaction, { as: 'walletTransactions', foreignKey: 'storeId' });
      Store.hasMany(db.PayoutAccount, { as: 'payoutAccounts', foreignKey: 'storeId' });
      Store.hasMany(db.Review, { as: 'reviews', foreignKey: 'storeId' });
    }

    /**
     * True when the partner has both capabilities on — the one condition
     * that makes the app show its Products|Services and Orders|Bookings
     * segmented controls (§3). A partner with one capability never sees a
     * segment they can't use.
     */
    get hasBothCapabilities() {
      return this.offersProducts && this.offersServices;
    }
  }

  Store.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      /** Exactly one owner per store — a PARTNER user. Managers/staff attach through their own table later, not here. */
      ownerUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      /** Null between "picked a business type" and "submitted KYC" — the name is collected on the KYC form, not the role screen. */
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      /**
       * The *shape* of the business, for KYC paperwork and admin
       * filtering. Deliberately decides nothing about navigation any more
       * — that is what the two flags below are for.
       */
      businessType: {
        type: DataTypes.ENUM(...Object.values(BusinessType)),
        allowNull: false,
        defaultValue: BusinessType.INDIVIDUAL,
      },
      /**
       * Sells pet supplies. Chosen at signup and widened later through the
       * "grow your business" flow.
       */
      offersProducts: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      /**
       * Offers bookable services.
       *
       * Widening only, in both directions of the pair: turning a
       * capability off would orphan live bookings and in-flight orders, so
       * a partner winding down pauses their listings instead. Nothing in
       * the API sets either flag back to false (§3).
       */
      offersServices: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(StoreStatus)),
        allowNull: false,
        defaultValue: StoreStatus.PENDING_KYC,
      },
      /** The human Petza staff verify the documents against — distinct from `User.name`, which may be a nickname. */
      ownerName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /** Street line, collected on the KYC form alongside city/state/pincode. */
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /** Set alongside `city`; a partner listing inherits all of these. */
      state: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      pincode: {
        type: DataTypes.STRING(12),
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /** The public "verified partner" badge — an admin sets it at approval; it is not implied by status alone. */
      isVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      /** Set alongside status = REJECTED; surfaced verbatim on the partner app's onboarding/pending screen. */
      rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      kycSubmittedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Store',
      tableName: 'stores',
    }
  );

  return Store;
};
