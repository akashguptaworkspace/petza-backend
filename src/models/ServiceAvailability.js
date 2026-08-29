import { DataTypes, Model } from 'sequelize';

/**
 * A recurring weekly window a service can be booked in — not a calendar of
 * dates. "Mon–Fri, 9am–1pm" is five rows (PRODUCT_CONTEXT.md §7).
 *
 * The bookable slots themselves are derived, never stored: a window plus
 * the listing's `durationMinutes` divides into slots, and each is open
 * until `maxBookingsPerSlot` bookings sit on it. Storing slots instead
 * would mean regenerating a table every time a partner edited their hours.
 */
export default (sequelize) => {
  class ServiceAvailability extends Model {
    static associate(db) {
      ServiceAvailability.belongsTo(db.ServiceListing, {
        as: 'serviceListing',
        foreignKey: 'serviceListingId',
      });
    }
  }

  ServiceAvailability.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      serviceListingId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      /** 0 = Sunday, matching `Date#getDay`, so neither side has to re-base the number. */
      dayOfWeek: {
        type: DataTypes.TINYINT,
        allowNull: false,
        validate: { min: 0, max: 6 },
      },
      /** `HH:MM:SS`, in the store's local time — a partner's hours don't move when a customer's do. */
      startTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      endTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      /** How many customers can hold the same slot — a groomer with two tables takes 2. */
      maxBookingsPerSlot: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      sequelize,
      modelName: 'ServiceAvailability',
      tableName: 'service_availability',
    }
  );

  return ServiceAvailability;
};
