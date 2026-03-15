'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Orders table indexes
    await queryInterface.addIndex('Orders', ['UserId']);
    await queryInterface.addIndex('Orders', ['orderDate']);
    await queryInterface.addIndex('Orders', ['orderStatus']);
    await queryInterface.addIndex('Orders', ['paymentStatus']);
    
    // OrderItems table indexes
    await queryInterface.addIndex('OrderItems', ['OrderId']);
    await queryInterface.addIndex('OrderItems', ['ProductId']);
    await queryInterface.addIndex('OrderItems', ['ProductVariantId']);

    // Products table indexes
    await queryInterface.addIndex('Products', ['UserId']);
    await queryInterface.addIndex('Products', ['CategoryId']);
    await queryInterface.addIndex('Products', ['BrandId']);
    await queryInterface.addIndex('Products', ['status']);
    await queryInterface.addIndex('Products', ['sku']);
    
    // ProductVariants table indexes
    await queryInterface.addIndex('ProductVariants', ['ProductId']);
    await queryInterface.addIndex('ProductVariants', ['sku']);

    // StockHistories table indexes
    await queryInterface.addIndex('StockHistories', ['ProductId']);
    await queryInterface.addIndex('StockHistories', ['ProductVariantId']);
    await queryInterface.addIndex('StockHistories', ['OrderId']);
    await queryInterface.addIndex('StockHistories', ['UserId']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove StockHistories indexes
    await queryInterface.removeIndex('StockHistories', ['UserId']);
    await queryInterface.removeIndex('StockHistories', ['OrderId']);
    await queryInterface.removeIndex('StockHistories', ['ProductVariantId']);
    await queryInterface.removeIndex('StockHistories', ['ProductId']);

    // Remove ProductVariants indexes
    await queryInterface.removeIndex('ProductVariants', ['sku']);
    await queryInterface.removeIndex('ProductVariants', ['ProductId']);

    // Remove Products indexes
    await queryInterface.removeIndex('Products', ['sku']);
    await queryInterface.removeIndex('Products', ['status']);
    await queryInterface.removeIndex('Products', ['BrandId']);
    await queryInterface.removeIndex('Products', ['CategoryId']);
    await queryInterface.removeIndex('Products', ['UserId']);

    // Remove OrderItems indexes
    await queryInterface.removeIndex('OrderItems', ['ProductVariantId']);
    await queryInterface.removeIndex('OrderItems', ['ProductId']);
    await queryInterface.removeIndex('OrderItems', ['OrderId']);

    // Remove Orders indexes
    await queryInterface.removeIndex('Orders', ['paymentStatus']);
    await queryInterface.removeIndex('Orders', ['orderStatus']);
    await queryInterface.removeIndex('Orders', ['orderDate']);
    await queryInterface.removeIndex('Orders', ['UserId']);
  }
};
