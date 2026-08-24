'use strict';

/**
 * Password reset reuses the OTP machinery that already exists for login and
 * registration — same hashing, same TTL, same attempt cap and resend
 * cooldown — so all it needs is a third purpose.
 *
 * Keeping it a distinct purpose (rather than reusing LOGIN) matters: an OTP
 * issued to sign in must not be replayable against the endpoint that sets a
 * new password, and vice versa. The purpose is part of the hashed subject,
 * so a code minted for one is cryptographically useless to the other.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE otp_challenges MODIFY purpose ENUM('LOGIN','REGISTER','RESET_PASSWORD') NOT NULL"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("DELETE FROM otp_challenges WHERE purpose = 'RESET_PASSWORD'");
    await queryInterface.sequelize.query(
      "ALTER TABLE otp_challenges MODIFY purpose ENUM('LOGIN','REGISTER') NOT NULL"
    );
  },
};
