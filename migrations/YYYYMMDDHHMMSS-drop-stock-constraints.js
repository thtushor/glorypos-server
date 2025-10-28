'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Drop foreign key constraints
        await queryInterface.removeConstraint('Stocks', 'Stocks_ibfk_1');

        // Drop the Stocks table
        await queryInterface.dropTable('Stocks');
    },

    down: async (queryInterface, Sequelize) => {
        // Recreate the Stocks table
        await queryInterface.createTable('Stocks', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            variantId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'ProductVariants',
                    key: 'id'
                }
            },
            quantity: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
    }
}; 