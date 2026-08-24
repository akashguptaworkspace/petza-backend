import { Op } from 'sequelize';

import db from '../../models/index.js';

const { PetAttribute, PetAttributeOption } = db;

const OPTION_INCLUDE = { model: PetAttributeOption, as: 'options' };

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
      include: [OPTION_INCLUDE],
      order: [
        ['displayOrder', 'ASC'],
        [OPTION_INCLUDE, 'displayOrder', 'ASC'],
      ],
    });
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
