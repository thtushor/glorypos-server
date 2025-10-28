'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // First drop any existing foreign key constraints
        try {
            await queryInterface.removeConstraint('OrderItems', 'OrderItems_ProductVariantId_fkey');
        } catch (error) {
            // Constraint might not exist
        }

        await queryInterface.createTable('OrderItems', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            quantity: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            unitPrice: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            subtotal: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            ProductId: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'Products',
                    key: 'id'
                }
            },
            ProductVariantId: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'ProductVariants',
                    key: 'id'
                }
            },
            OrderId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'Orders',
                    key: 'id'
                }
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
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('OrderItems');
    }
}; 