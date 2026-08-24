'use strict';

/**
 * The supplies pillar's catalogue: products and their variants.
 *
 * Separate from `pet_listings` on purpose — a product has pack-size
 * variants with their own price and stock, is bought in quantity, and
 * carries a brand that isn't the seller (PLATFORM_CONTEXT.md §2.4).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'stores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      brand: { type: Sequelize.STRING, allowNull: true },
      category_slug: { type: Sequelize.STRING, allowNull: false },
      pet_types: { type: Sequelize.JSON, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      image_url: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('DRAFT', 'ACTIVE', 'ARCHIVED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // Every partner catalogue query is "this store's products, by status,
    // newest first" — the one index that serves the whole list screen.
    await queryInterface.addIndex('products', ['store_id', 'status', 'created_at'], {
      name: 'products_store_status_created_at',
    });
    await queryInterface.addIndex('products', ['category_slug'], { name: 'products_category_slug' });

    await queryInterface.createTable('product_variants', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      label: { type: Sequelize.STRING, allowNull: false },
      sku: { type: Sequelize.STRING, allowNull: true },
      price_in_inr: { type: Sequelize.INTEGER, allowNull: false },
      mrp_in_inr: { type: Sequelize.INTEGER, allowNull: true },
      stock_quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      low_stock_threshold: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 5 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('product_variants', ['product_id', 'position'], {
      name: 'product_variants_product_position',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_variants');
    await queryInterface.dropTable('products');
  },
};
