import { DataTypes, Model } from 'sequelize';

import { ModerationStatus, ServiceListingStatus, ServiceLocationType } from '../config/constants.js';

/**
 * One bookable service — a grooming session, a consultation, a night of
 * boarding (PRODUCT_CONTEXT.md §4.2, §7).
 *
 * Kept apart from `ProductListing` because almost nothing overlaps: this
 * has a duration, a location type and a weekly availability grid, and no
 * stock, MRP or SKU. One table for both would be two thirds nulls.
 *
 * Same two-part publish gate as products (§8).
 */
export default (sequelize) => {
  class ServiceListing extends Model {
    static associate(db) {
      ServiceListing.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
      ServiceListing.belongsTo(db.Category, { as: 'category', foreignKey: 'categoryId' });
      ServiceListing.hasMany(db.ServiceAvailability, {
        as: 'availability',
        foreignKey: 'serviceListingId',
      });
      ServiceListing.hasMany(db.Booking, { as: 'bookings', foreignKey: 'serviceListingId' });
    }

    get isPubliclyVisible() {
      return this.status === ServiceListingStatus.ACTIVE && this.moderationStatus === ModerationStatus.APPROVED;
    }
  }

  ServiceListing.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      storeId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      /** One of the seven service categories. Flat — services have no tag level. */
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      /** How long one booking blocks out — what turns an availability window into slots. */
      durationMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      priceInInr: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      locationType: {
        type: DataTypes.ENUM(...Object.values(ServiceLocationType)),
        allowNull: false,
        defaultValue: ServiceLocationType.AT_STORE,
      },
      attributes: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      images: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      status: {
        type: DataTypes.ENUM(...Object.values(ServiceListingStatus)),
        allowNull: false,
        defaultValue: ServiceListingStatus.DRAFT,
      },
      moderationStatus: {
        type: DataTypes.ENUM(...Object.values(ModerationStatus)),
        allowNull: false,
        defaultValue: ModerationStatus.PENDING,
      },
      moderationNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      moderatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      moderatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ServiceListing',
      tableName: 'service_listings',
    }
  );

  return ServiceListing;
};
