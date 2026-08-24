import { DataTypes, Model } from 'sequelize';

/** The SUPPLIER half of a store's KYC — see KennelProfile.js for why these live in per-business-type tables. */
export default (sequelize) => {
  class SupplierProfile extends Model {
    static associate(db) {
      SupplierProfile.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
    }
  }

  SupplierProfile.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      storeId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      /** A supplies seller is a trading business, so GST is the proof Petza staff verify — unlike a vet's council licence. */
      gstNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      /** Where stock ships from, which is not always where the business is registered. */
      warehouseCity: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /** Brand slugs they stock. The customer app's brand facet reads products.brand; this is what they declared at KYC. */
      brandsStocked: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      /** Which catalogue categories they trade in, e.g. ["dry-food","toys"]. */
      categories: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      /** Whether they ship anywhere in India or only around their city — it changes who can see their listings. */
      shipsNationwide: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'SupplierProfile',
      tableName: 'supplier_profiles',
    }
  );

  return SupplierProfile;
};
