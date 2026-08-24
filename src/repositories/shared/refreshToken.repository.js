import db from '../../models/index.js';

const { RefreshToken, sequelize } = db;

/** Only place `refresh_tokens` table queries live — services never touch the model directly. */
export const refreshTokenRepository = {
  create(payload, options) {
    return RefreshToken.create(payload, options);
  },

  findActiveByHash(tokenHash) {
    return RefreshToken.findOne({ where: { tokenHash } });
  },

  /** Revokes `id` and atomically inserts its replacement — rotation happens as one transaction so a crash between the two never leaves a token double-spendable. */
  async rotate({ id, replacedByHash, newRow }) {
    return sequelize.transaction(async (transaction) => {
      await RefreshToken.update({ revokedAt: new Date(), replacedByHash }, { where: { id }, transaction });
      return RefreshToken.create(newRow, { transaction });
    });
  },

  async revokeByHash(tokenHash) {
    await RefreshToken.update({ revokedAt: new Date() }, { where: { tokenHash, revokedAt: null } });
  },

  /** Called when a revoked/expired token is presented again — a signal the chain may be compromised, so every session for this user is killed. */
  async revokeAllForUser(userId) {
    await RefreshToken.update({ revokedAt: new Date() }, { where: { userId, revokedAt: null } });
  },
};
