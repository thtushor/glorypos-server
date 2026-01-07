'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Remove the old unique constraint on sku
        await queryInterface.removeConstraint('Products', 'sku_code');

        // Add the new composite unique index on UserId and sku
        await queryInterface.addIndex('Products', ['UserId', 'sku'], {
            unique: true,
            name: 'unique_sku_per_shop'
        });
    },

    down: async (queryInterface, Sequelize) => {
        // Remove the composite unique index
        await queryInterface.removeIndex('Products', 'unique_sku_per_shop');

        // Restore the old unique constraint on sku
        await queryInterface.addConstraint('Products', {
            fields: ['sku'],
            type: 'unique',
            name: 'sku_code'
        });
    }
};
