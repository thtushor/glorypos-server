'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // First drop the existing primary key
        await queryInterface.removeConstraint('Orders', 'PRIMARY');

        // Remove the old orderId column
        await queryInterface.removeColumn('Orders', 'orderId');

        // Add the new id column
        await queryInterface.addColumn('Orders', 'id', {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
        });

        // Add orderNumber column
        await queryInterface.addColumn('Orders', 'orderNumber', {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        });

        // Add new columns
        await queryInterface.addColumn('Orders', 'customerEmail', {
            type: Sequelize.STRING,
            allowNull: true
        });

        await queryInterface.addColumn('Orders', 'discount', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        });

        // Modify existing columns
        await queryInterface.changeColumn('Orders', 'subtotal', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false
        });

        await queryInterface.changeColumn('Orders', 'tax', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        });

        await queryInterface.changeColumn('Orders', 'total', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false
        });

        // Update payment method to ENUM
        await queryInterface.changeColumn('Orders', 'paymentMethod', {
            type: Sequelize.ENUM("cash", "card", "mobile_banking"),
            allowNull: false
        });

        // Add new status columns
        await queryInterface.addColumn('Orders', 'paymentStatus', {
            type: Sequelize.ENUM("pending", "completed", "failed"),
            defaultValue: "pending"
        });

        await queryInterface.addColumn('Orders', 'orderStatus', {
            type: Sequelize.ENUM("pending", "processing", "completed", "cancelled"),
            defaultValue: "pending"
        });

        // Remove unused columns
        await queryInterface.removeColumn('Orders', 'verificationCode');
        await queryInterface.removeColumn('Orders', 'expiryDate');
        await queryInterface.removeColumn('Orders', 'items');

        // Rename date to orderDate
        await queryInterface.renameColumn('Orders', 'date', 'orderDate');
    },

    down: async (queryInterface, Sequelize) => {
        // Revert all changes in reverse order
        await queryInterface.renameColumn('Orders', 'orderDate', 'date');

        await queryInterface.addColumn('Orders', 'items', {
            type: Sequelize.JSON,
            allowNull: false
        });

        await queryInterface.addColumn('Orders', 'expiryDate', {
            type: Sequelize.DATE,
            allowNull: false
        });

        await queryInterface.addColumn('Orders', 'verificationCode', {
            type: Sequelize.STRING,
            allowNull: true
        });

        await queryInterface.removeColumn('Orders', 'orderStatus');
        await queryInterface.removeColumn('Orders', 'paymentStatus');
        await queryInterface.removeColumn('Orders', 'discount');
        await queryInterface.removeColumn('Orders', 'customerEmail');
        await queryInterface.removeColumn('Orders', 'orderNumber');

        await queryInterface.removeColumn('Orders', 'id');

        await queryInterface.addColumn('Orders', 'orderId', {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false
        });
    }
}; 