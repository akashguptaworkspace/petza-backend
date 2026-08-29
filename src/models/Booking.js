import { DataTypes, Model } from 'sequelize';

import { BookingStatus, BookingStatusTransitions, ServiceLocationType } from '../config/constants.js';

/**
 * A customer's appointment against one service listing
 * (PRODUCT_CONTEXT.md §5, §7).
 *
 * Like an order line, the parts that describe *what was agreed* are
 * snapshots: `serviceName`, `durationMinutes` and `priceAtBookingInInr`
 * are copied at booking time. A partner shortening a service or raising
 * its price next week must not silently shrink or reprice appointments
 * already in someone's calendar.
 */
export default (sequelize) => {
  class Booking extends Model {
    static associate(db) {
      Booking.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
      Booking.belongsTo(db.User, { as: 'customer', foreignKey: 'customerUserId' });
      Booking.belongsTo(db.ServiceListing, { as: 'serviceListing', foreignKey: 'serviceListingId' });
    }

    get allowedNextStatuses() {
      return BookingStatusTransitions[this.status] ?? [];
    }

    /** When the slot frees up again — what the calendar view lays out against. */
    get endsAt() {
      return new Date(new Date(this.scheduledAt).getTime() + this.durationMinutes * 60_000);
    }
  }

  Booking.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      storeId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      customerUserId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      serviceListingId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      bookingNumber: {
        type: DataTypes.STRING(24),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(BookingStatus)),
        allowNull: false,
        defaultValue: BookingStatus.UPCOMING,
      },
      /** Snapshot, same reasoning as `OrderItem.productName`. */
      serviceName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      durationMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      priceAtBookingInInr: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      locationType: {
        type: DataTypes.ENUM(...Object.values(ServiceLocationType)),
        allowNull: false,
        defaultValue: ServiceLocationType.AT_STORE,
      },
      /** Only set for HOME_VISIT, and snapshotted like a shipping address. */
      visitAddress: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      customerNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      cancellationReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      /** Set when status reaches COMPLETED — the transition that writes the EARNING ledger row. */
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Booking',
      tableName: 'bookings',
    }
  );

  return Booking;
};
