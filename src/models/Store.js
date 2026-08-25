import { DataTypes, Model } from 'sequelize';

import { BusinessType, StoreStatus } from '../config/constants.js';

/**
 * The one row a partner resolves to — see PLATFORM_CONTEXT.md §2's
 * "one partner, many capabilities" decision: a business is never split
 * across `stores`/`vendors`/`service_providers` peer tables, it is one
 * store row plus a capability set plus a per-business-type profile
 * (kennel_profiles / vet_profiles / trainer_profiles / groomer_profiles /
 * supplier_profiles).
 *
 * Created the moment the partner picks what they do (the role screen),
 * which is *before* they have told us the business name — so `name` and
 * `slug` stay null until KYC submits them.
 */
export default (sequelize) => {
  class Store extends Model {
    static associate(db) {
      Store.belongsTo(db.User, { as: 'owner', foreignKey: 'ownerUserId' });
      Store.hasMany(db.StoreKycDocument, { as: 'kycDocuments', foreignKey: 'storeId' });
      Store.hasOne(db.KennelProfile, { as: 'kennelProfile', foreignKey: 'storeId' });
      Store.hasOne(db.VetProfile, { as: 'vetProfile', foreignKey: 'storeId' });
      Store.hasOne(db.TrainerProfile, { as: 'trainerProfile', foreignKey: 'storeId' });
      Store.hasOne(db.GroomerProfile, { as: 'groomerProfile', foreignKey: 'storeId' });
      Store.hasOne(db.SupplierProfile, { as: 'supplierProfile', foreignKey: 'storeId' });
    }
  }

  Store.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      /** Exactly one owner per store — a PARTNER_OWNER user. Managers/staff attach through their own table later, not here. */
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
      /** What this partner does — decides their dashboard. No PET_SHOP member by design; see config/constants.js. */
      businessType: {
        type: DataTypes.ENUM(...Object.values(BusinessType)),
        allowNull: false,
      },
      /**
       * Which pillars this store runs — the partner app opens one route
       * group per capability. Derived server-side from businessType
       * (BusinessTypeCapabilities) at signup and widened only through
       * PATCH /partner/store/capabilities; never taken from a client as-is.
       *
       * The column is a MySQL `SET`, which Sequelize has no DataType for —
       * the driver hands it over as a comma-joined string either way, so
       * it is declared as STRING here and the getter/setter do the one
       * translation, keeping every caller in arrays.
       */
      capabilities: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '',
        get() {
          const raw = this.getDataValue('capabilities');
          return raw ? String(raw).split(',') : [];
        },
        set(value) {
          this.setDataValue('capabilities', Array.isArray(value) ? value.join(',') : (value ?? ''));
        },
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
