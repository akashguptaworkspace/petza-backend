import { Op } from 'sequelize';

import db from '../../models/index.js';

const { PetAttribute, PetAttributeOption } = db;

/** What the form offers: retired choices are hidden from new listings. */
const ACTIVE_OPTION_INCLUDE = { model: PetAttributeOption, as: 'options', where: { isActive: true }, required: false };

/**
 * What validation accepts: every option, retired ones included.
 *
 * Wider than the form on purpose — someone editing a listing published
 * under a breed that has since been retired must be able to save it again
 * without being told a field they never touched is invalid.
 */
const ANY_OPTION_INCLUDE = { model: PetAttributeOption, as: 'options' };

/** Only place `pet_attributes` / `pet_attribute_options` are read. */
export const petAttributeRepository = {
  /**
   * The form for one pet type: every common field plus that animal's own.
   *
   * Passing no `petType` returns just the common fields — which is what the
   * app asks for before the partner has chosen one, since the pet-type
   * dropdown itself lives in that set.
   *
   * One query, not two: the common and per-type rows differ only by the
   * `pet_type` column, so a single OR reads both and the ordering below
   * puts them in render order across the whole form.
   */
  findSchema(petType) {
    const scopes = [{ petType: null }];
    if (petType) scopes.push({ petType });

    return PetAttribute.findAll({
      where: { [Op.or]: scopes },
      include: [ACTIVE_OPTION_INCLUDE],
      order: [
        ['displayOrder', 'ASC'],
        [ACTIVE_OPTION_INCLUDE, 'displayOrder', 'ASC'],
      ],
    });
  },

  /** The same attributes, with every option — see `ANY_OPTION_INCLUDE`. Used only to validate a listing being written. */
  findSchemaForValidation(petType) {
    const scopes = [{ petType: null }];
    if (petType) scopes.push({ petType });

    return PetAttribute.findAll({ where: { [Op.or]: scopes }, include: [ANY_OPTION_INCLUDE] });
  },

  /** Every pet type that has a CATEGORY section defined — used to tell a caller which animals are fully described. */
  async findTypesWithCategorySection() {
    const rows = await PetAttribute.findAll({
      attributes: ['petType'],
      where: { petType: { [Op.ne]: null } },
      group: ['petType'],
      raw: true,
    });

    return rows.map((row) => row.petType);
  },
};
