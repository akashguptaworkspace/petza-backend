import { Op } from 'sequelize';

import db from '../../models/index.js';

const { Category, CategoryAttribute } = db;

/** Attributes always come back in the order admin arranged them — the form renders them top to bottom exactly as listed. */
const ATTRIBUTE_INCLUDE = {
  model: CategoryAttribute,
  as: 'attributes',
  separate: true,
  order: [['sortOrder', 'ASC']],
};

/**
 * The taxonomy, read-side. Only place `categories` and
 * `category_attributes` are queried.
 *
 * Everything here filters on `isActive` by default: a category admin has
 * retired must stop being offered to partners, while the listings already
 * under it keep resolving (which is why retiring is a flag, never a
 * delete).
 */
export const categoryRepository = {
  /**
   * The picker's data: active top-level categories of one kind, each with
   * its children and their form fields.
   *
   * Products come back as one root ("Accessories") whose `children` are
   * the selectable tags; services come back as seven roots with no
   * children. The app renders whichever shape it gets rather than knowing
   * which to expect (§10).
   */
  findTree(listingType) {
    return Category.findAll({
      where: { listingType, isActive: true, parentId: null },
      include: [
        ATTRIBUTE_INCLUDE,
        {
          model: Category,
          as: 'children',
          required: false,
          where: { isActive: true },
          include: [ATTRIBUTE_INCLUDE],
        },
      ],
      order: [
        ['sortOrder', 'ASC'],
        [{ model: Category, as: 'children' }, 'sortOrder', 'ASC'],
      ],
    });
  },

  /** One category with the fields a listing under it has to answer. */
  findByIdWithAttributes(id) {
    return Category.findByPk(id, { include: [ATTRIBUTE_INCLUDE] });
  },

  findBySlug(slug, options) {
    return Category.findOne({ where: { slug }, ...options });
  },

  findByIds(ids) {
    if (!ids.length) return Promise.resolve([]);
    return Category.findAll({ where: { id: { [Op.in]: ids } } });
  },

  /** Admin's Catalog screens, which unlike the partner pickers must see retired rows too. */
  findAllForAdmin(listingType) {
    return Category.findAll({
      where: listingType ? { listingType } : {},
      include: [ATTRIBUTE_INCLUDE],
      order: [
        ['listingType', 'ASC'],
        ['sortOrder', 'ASC'],
      ],
    });
  },

  create(payload, options) {
    return Category.create(payload, options);
  },

  update(category, payload, options) {
    return category.update(payload, options);
  },
};
