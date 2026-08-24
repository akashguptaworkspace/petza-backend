import { DataTypes, Model } from 'sequelize';

import { MessageSenderType } from '../config/constants.js';

/** One message inside an Enquiry thread. */
export default (sequelize) => {
  class Message extends Model {
    static associate(db) {
      Message.belongsTo(db.Enquiry, { as: 'enquiry', foreignKey: 'enquiryId' });
      Message.belongsTo(db.User, { as: 'sender', foreignKey: 'senderId' });
    }
  }

  Message.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      enquiryId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      senderType: {
        type: DataTypes.ENUM(...Object.values(MessageSenderType)),
        allowNull: false,
      },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      /** Null until the other side opens the thread — see the migration comment for why one column covers both directions. */
      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Message',
      tableName: 'messages',
    }
  );

  return Message;
};
