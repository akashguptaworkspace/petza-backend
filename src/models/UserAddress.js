import { DataTypes, Model } from 'sequelize';

export const AddressType = {
  HOME: 'HOME',
  WORK: 'WORK',
  OTHER: 'OTHER',
  PARENTS_HOME: 'PARENTS_HOME',
};

export default (sequelize) => {
  class UserAddress extends Model {
    static associate(db) {
      UserAddress.belongsTo(db.User, { as: 'user', foreignKey: 'userId' });
    }
  }

  UserAddress.init(
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
      type: {
        type: DataTypes.ENUM(...Object.values(AddressType)),
        allowNull: false,
        defaultValue: AddressType.HOME,
      },
      fullName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mobileNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      pincode: {
        type: DataTypes.STRING(12),
        allowNull: false,
      },
      addressLine: {
        type: DataTypes.STRING(240),
        allowNull: false,
      },
      landmark: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'India',
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'UserAddress',
      tableName: 'user_addresses',
    }
  );

  return UserAddress;
};
