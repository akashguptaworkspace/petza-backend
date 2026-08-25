import { DataTypes, Model } from 'sequelize';

/**
 * One answer a listing gave to one attribute.
 *
 * Replaces the `attributes` JSON blob, which was keyed by the attribute's
 * `key` string — so renaming a key in an admin panel silently stranded every
 * listing's answer to it. Keyed by `attributeId`, a rename is a one-row edit
 * that changes nothing here.
 *
 * A choice answer carries `optionId` and nothing else; a multi-select is
 * several rows. Everything else lands in the typed column its input calls
 * for, so a number stays a number and a date stays a date instead of every
 * answer being text.
 */
export default (sequelize) => {
  class PetListingAttributeValue extends Model {
    static associate(db) {
      PetListingAttributeValue.belongsTo(db.PetListing, { as: 'listing', foreignKey: 'petListingId' });
      PetListingAttributeValue.belongsTo(db.PetAttribute, { as: 'attribute', foreignKey: 'attributeId' });
      PetListingAttributeValue.belongsTo(db.PetAttributeOption, { as: 'option', foreignKey: 'optionId' });
    }

    /** The answer as the API should present it, whichever column holds it. */
    get resolvedValue() {
      if (this.optionId) return this.option?.value ?? null;
      if (this.valueBoolean !== null && this.valueBoolean !== undefined) return this.valueBoolean;
      if (this.valueNumber !== null && this.valueNumber !== undefined) return Number(this.valueNumber);
      if (this.valueDate) return this.valueDate;
      return this.valueText ?? null;
    }
  }

  PetListingAttributeValue.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      petListingId: { type: DataTypes.UUID, allowNull: false },
      attributeId: { type: DataTypes.UUID, allowNull: false },
      optionId: { type: DataTypes.UUID, allowNull: true },
      valueText: { type: DataTypes.TEXT, allowNull: true },
      valueNumber: { type: DataTypes.DECIMAL(14, 4), allowNull: true },
      valueBoolean: { type: DataTypes.BOOLEAN, allowNull: true },
      valueDate: { type: DataTypes.DATEONLY, allowNull: true },
    },
    { sequelize, modelName: 'PetListingAttributeValue', tableName: 'pet_listing_attribute_values' }
  );

  return PetListingAttributeValue;
};
