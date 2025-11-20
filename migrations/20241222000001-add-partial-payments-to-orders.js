'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Update paymentMethod ENUM to include 'wallet' and 'mixed'
        await queryInterface.sequelize.query(`
            ALTER TABLE Orders MODIFY COLUMN paymentMethod ENUM('cash', 'card', 'mobile_banking', 'wallet', 'mixed') 
            NOT NULL DEFAULT 'cash';
        `);

        // Update paymentStatus ENUM to include 'partial'
        await queryInterface.sequelize.query(`
            ALTER TABLE Orders MODIFY COLUMN paymentStatus ENUM('pending', 'completed', 'failed', 'partial') 
            DEFAULT 'pending';
        `);

        // Add partial payment tracking fields
        await queryInterface.addColumn('Orders', 'cashAmount', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0,
            comment: "Amount paid in cash"
        });

        await queryInterface.addColumn('Orders', 'cardAmount', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0,
            comment: "Amount paid by card"
        });

        await queryInterface.addColumn('Orders', 'walletAmount', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0,
            comment: "Amount paid from wallet"
        });

        await queryInterface.addColumn('Orders', 'paidAmount', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
            comment: "Total amount paid (sum of cash, card, wallet)"
        });

        // Set default paidAmount for existing orders to match total
        await queryInterface.sequelize.query(`
            UPDATE Orders 
            SET paidAmount = total, 
                cashAmount = CASE WHEN paymentMethod = 'cash' THEN total ELSE 0 END,
                cardAmount = CASE WHEN paymentMethod = 'card' THEN total ELSE 0 END,
                walletAmount = CASE WHEN paymentMethod = 'wallet' THEN total ELSE 0 END
            WHERE paymentStatus = 'completed';
        `);
    },

    down: async (queryInterface, Sequelize) => {
        // Remove added columns
        await queryInterface.removeColumn('Orders', 'paidAmount');
        await queryInterface.removeColumn('Orders', 'walletAmount');
        await queryInterface.removeColumn('Orders', 'cardAmount');
        await queryInterface.removeColumn('Orders', 'cashAmount');

        // Revert paymentStatus ENUM
        await queryInterface.sequelize.query(`
            ALTER TABLE Orders MODIFY COLUMN paymentStatus ENUM('pending', 'completed', 'failed') 
            DEFAULT 'pending';
        `);

        // Revert paymentMethod ENUM
        await queryInterface.sequelize.query(`
            ALTER TABLE Orders MODIFY COLUMN paymentMethod ENUM('cash', 'card', 'mobile_banking') 
            NOT NULL;
        `);
    }
};

