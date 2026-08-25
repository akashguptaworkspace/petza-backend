import { DataTypes, Model } from 'sequelize';

import { EnquiryStatus } from '../config/constants.js';

/**
 * One conversation between a customer and a store, about a pet listing.
 * See the create-enquiries migration for why `storeId` is denormalized off
 * the listing rather than reached through a join.
 */
export default (sequelize) => {
  class Enquiry extends Model {
    static associate(db) {
      Enquiry.belongsTo(db.User, { as: 'customer', foreignKey: 'customerId' });
      Enquiry.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
      Enquiry.belongsTo(db.User, { as: 'individualOwner', foreignKey: 'individualOwnerId' });
      Enquiry.belongsTo(db.PetListing, { as: 'petListing', foreignKey: 'petListingId' });
      Enquiry.hasMany(db.Message, { as: 'messages', foreignKey: 'enquiryId' });
    }
  }

  Enquiry.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      customerId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      /**
       * Denormalized from petListing.storeId at creation — never taken from
       * a request body. Null when the pet was listed by a person; exactly
       * one of this and `individualOwnerId` is set.
       */
      storeId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      /** Denormalized from petListing.individualOwnerId, same rule as storeId. */
      individualOwnerId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      petListingId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(EnquiryStatus)),
        allowNull: false,
        defaultValue: EnquiryStatus.NEW,
      },
      lastMessageAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastMessageFromPartner: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Enquiry',
      tableName: 'enquiries',
    }
  );

  return Enquiry;
};
