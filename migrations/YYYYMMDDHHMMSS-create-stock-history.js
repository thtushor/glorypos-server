'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // First drop any existing foreign key constraints
        try {
            await queryInterface.removeConstraint('StockHistories', 'StockHistories_ProductVariantId_fkey');
        } catch (error) {
            // Constraint might not exist
        }

        await queryInterface.createTable('StockHistories', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            type: {
                type: Sequelize.ENUM("order", "adjustment", "return"),
                allowNull: false,
            },
            quantity: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            previousStock: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            newStock: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            note: {
                type: Sequelize.TEXT,
                allowNull: true,
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
                allowNull: true,
                references: {
                    model: 'Orders',
                    key: 'id'
                }
            },
            UserId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'Users',
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
        await queryInterface.dropTable('StockHistories');
    }
}; 