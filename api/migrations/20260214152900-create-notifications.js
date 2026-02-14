'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Try to drop the table first to avoid "Table exists" error during development/retry
        try {
            await queryInterface.dropTable('Notifications');
        } catch (e) {
            console.log('Notifications table did not exist or could not be dropped.');
        }

        await queryInterface.createTable('Notifications', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            shop_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'Users', // Assuming the table name is 'Users'
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            title: {
                type: Sequelize.STRING,
                allowNull: false
            },
            message: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            type: {
                type: Sequelize.ENUM('ORDER_CREATED', 'STOCK_LOW', 'STOCK_OUT'),
                allowNull: false
            },
            link: {
                type: Sequelize.STRING,
                allowNull: true
            },
            reference_id: {
                type: Sequelize.STRING,
                allowNull: true
            },
            reference_type: {
                type: Sequelize.ENUM('order', 'product'),
                allowNull: true
            },
            is_read: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });

        // Add indexes
        // Note: shop_id foreign key automatically creates an index in MySQL, so we skip explicit index to avoid duplication error.
        await queryInterface.addIndex('Notifications', ['is_read']);
        await queryInterface.addIndex('Notifications', ['type']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('Notifications');
    }
};
