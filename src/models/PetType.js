import { DataTypes, Model } from 'sequelize';

/**
 * A species a pet can be listed as.
 *
 * A table rather than a frozen map in code, so adding "Turtle" is an insert
 * an admin can make instead of a constants edit and a deploy. `value` is the
 * stable machine key ('DOG') that listings and attributes are keyed on and
 * is unique; `label` is display text and free to be reworded.
 *
 * Retire with `isActive`, never delete: the foreign keys are RESTRICT, so a
 * type still in use cannot be removed — which is the point. Deleting one
 * would strand every listing under it.
 */
export default (sequelize) => {
  class PetType extends Model {
    static associate(db) {
      PetType.hasMany(db.PetListing, { as: 'listings', foreignKey: 'petTypeId' });
      PetType.hasMany(db.PetAttribute, { as: 'attributes', foreignKey: 'petTypeId' });
    }
  }

  PetType.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      value: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      label: { type: DataTypes.STRING(120), allowNull: false },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { sequelize, modelName: 'PetType', tableName: 'pet_types' }
  );

  return PetType;
};
