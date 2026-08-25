import db from '../../models/index.js';

const { PetType } = db;

/** Only place `pet_types` is read. */
export const petTypeRepository = {
  /** Every type the apps may offer, retired ones excluded. */
  findActive() {
    return PetType.findAll({ where: { isActive: true }, order: [['displayOrder', 'ASC']] });
  },

  /**
   * By its stable machine key ('DOG').
   *
   * Retired types resolve too: a listing published under one must keep
   * saving, exactly as a retired option must — hiding a type from the form
   * is not the same as invalidating what already exists.
   */
  findByValue(value) {
    if (!value) return null;
    return PetType.findOne({ where: { value } });
  },
};
