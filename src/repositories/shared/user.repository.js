import { Op } from 'sequelize';

import db from '../../models/index.js';

const { User } = db;

/** Only place `users` table queries live — services never touch the model directly. */
export const userRepository = {
  findByEmailWithPassword(email) {
    return User.scope('withPassword').findOne({ where: { email: email.toLowerCase() } });
  },

  findById(id) {
    return User.findByPk(id);
  },

  /** The default scope hides passwordHash — this is for the one caller that has to compare against it (changePassword). */
  findByIdWithPassword(id) {
    return User.scope('withPassword').findByPk(id);
  },

  findByEmail(email) {
    return User.findOne({ where: { email: email.toLowerCase() } });
  },

  findByPhone(phone) {
    return User.findOne({ where: { phone } });
  },

  findByEmailOrPhone({ email, phone }) {
    const conditions = [];
    if (email) conditions.push({ email: email.toLowerCase() });
    if (phone) conditions.push({ phone });
    if (!conditions.length) return null;
    return User.findOne({ where: { [Op.or]: conditions } });
  },

  create(payload, options) {
    return User.create(payload, options);
  },

  update(user, payload, options) {
    return user.update(payload, options);
  },
};
