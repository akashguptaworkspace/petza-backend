import db, { sequelize } from '../../models/index.js';
import { NotFoundError } from '../../shared/errors/AppError.js';

function toAddressDto(address) {
  return {
    id: address.id,
    type: address.type,
    fullName: address.fullName,
    mobileNumber: address.mobileNumber,
    pincode: address.pincode,
    addressLine: address.addressLine,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    country: address.country,
    isDefault: address.isDefault,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

async function ensureSingleDefault({ userId, addressId, transaction }) {
  await db.UserAddress.update(
    { isDefault: false },
    {
      where: {
        userId,
        ...(addressId ? { id: { [db.Sequelize.Op.ne]: addressId } } : {}),
      },
      transaction,
    }
  );
}

export const addressService = {
  async listForUser(userId) {
    const rows = await db.UserAddress.findAll({
      where: { userId },
      order: [
        ['isDefault', 'DESC'],
        ['createdAt', 'ASC'],
      ],
    });

    return rows.map(toAddressDto);
  },

  async create(userId, payload) {
    return sequelize.transaction(async (transaction) => {
      const addressCount = await db.UserAddress.count({ where: { userId }, transaction });
      const shouldBeDefault = payload.isDefault || addressCount === 0;

      if (shouldBeDefault) await ensureSingleDefault({ userId, transaction });

      const address = await db.UserAddress.create(
        {
          ...payload,
          landmark: payload.landmark || null,
          isDefault: shouldBeDefault,
          userId,
        },
        { transaction }
      );

      return toAddressDto(address);
    });
  },

  async update(userId, addressId, payload) {
    return sequelize.transaction(async (transaction) => {
      const address = await db.UserAddress.findOne({ where: { id: addressId, userId }, transaction });
      if (!address) throw new NotFoundError('Address not found');

      if (payload.isDefault) await ensureSingleDefault({ userId, addressId, transaction });

      await address.update(
        {
          ...payload,
          landmark: Object.prototype.hasOwnProperty.call(payload, 'landmark') ? payload.landmark || null : address.landmark,
        },
        { transaction }
      );

      return toAddressDto(address);
    });
  },

  async remove(userId, addressId) {
    return sequelize.transaction(async (transaction) => {
      const address = await db.UserAddress.findOne({ where: { id: addressId, userId }, transaction });
      if (!address) throw new NotFoundError('Address not found');

      const wasDefault = address.isDefault;
      await address.destroy({ transaction });

      if (wasDefault) {
        const nextAddress = await db.UserAddress.findOne({
          where: { userId },
          order: [['createdAt', 'ASC']],
          transaction,
        });
        if (nextAddress) await nextAddress.update({ isDefault: true }, { transaction });
      }

      return { id: addressId };
    });
  },
};
