import { DataTypes, Model } from 'sequelize';

export default (sequelize) => {
  class OtpChallenge extends Model {}

  OtpChallenge.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      /**
       * Part of the hashed subject, not just a label — a code minted to sign
       * in is cryptographically useless against the reset-password endpoint.
       */
      purpose: {
        type: DataTypes.ENUM('LOGIN', 'REGISTER', 'RESET_PASSWORD'),
        allowNull: false,
      },
      channel: {
        type: DataTypes.ENUM('EMAIL', 'SMS'),
        allowNull: false,
      },
      destination: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      codeHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      consumedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'OtpChallenge',
      tableName: 'otp_challenges',
    }
  );

  return OtpChallenge;
};
