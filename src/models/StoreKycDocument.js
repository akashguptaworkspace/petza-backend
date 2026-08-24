import { DataTypes, Model } from 'sequelize';

/**
 * One uploaded proof per row (licence, registration certificate, owner ID
 * …). `fileUrl` currently holds whatever URI the app hands us — the
 * presigned-upload/`media` pipeline is a later phase, and this table points
 * at a `media_id` instead once that exists.
 */
export default (sequelize) => {
  class StoreKycDocument extends Model {
    static associate(db) {
      StoreKycDocument.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
    }
  }

  StoreKycDocument.init(
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
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'StoreKycDocument',
      tableName: 'store_kyc_documents',
    }
  );

  return StoreKycDocument;
};
