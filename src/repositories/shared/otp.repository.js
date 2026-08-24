import db from '../../models/index.js';

const { OtpChallenge } = db;

/** Only place `otp_challenges` table queries live — services never touch the model directly. */
export const otpRepository = {
  findLatestActive({ destination, channel, purpose }) {
    return OtpChallenge.findOne({
      where: { destination, channel, purpose, consumedAt: null },
      order: [['createdAt', 'DESC']],
    });
  },

  async invalidateActive({ destination, channel, purpose, transaction }) {
    await OtpChallenge.update(
      { consumedAt: new Date() },
      { where: { destination, channel, purpose, consumedAt: null }, transaction }
    );
  },

  create(payload, options) {
    return OtpChallenge.create(payload, options);
  },

  incrementAttempts(challenge) {
    return challenge.increment('attempts');
  },

  markConsumed(challenge) {
    return challenge.update({ consumedAt: new Date() });
  },
};
