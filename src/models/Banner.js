import { DataTypes, Model } from 'sequelize';

/**
 * A hero/promo slot on the *customer* app, authored from the admin shell
 * (PRODUCT_CONTEXT.md §8).
 *
 * Two independent controls on whether it shows: `isActive`, which an admin
 * flips by hand, and the `startsAt`/`endsAt` window. Both must pass. That
 * combination is what lets a campaign be scheduled weeks ahead and still
 * be killed instantly without editing its dates.
 */
export default (sequelize) => {
  class Banner extends Model {
    /** Both gates, in one place, so no caller checks only half. */
    isLiveAt(now = new Date()) {
      if (!this.isActive) return false;
      if (this.startsAt && now < this.startsAt) return false;
      if (this.endsAt && now > this.endsAt) return false;
      return true;
    }
  }

  Banner.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subtitle: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ctaText: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      /** A deep link into the customer app, not a web URL. */
      ctaLink: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      /** Both null means "live whenever `isActive`". */
      startsAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      endsAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Banner',
      tableName: 'banners',
    }
  );

  return Banner;
};
