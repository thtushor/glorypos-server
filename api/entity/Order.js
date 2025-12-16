const Sequelize = require('sequelize');
const sequelize = require('../db'); // Ensure the proper database connection is configured

// Models
const Order = sequelize.define('Order', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    orderNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: "orderNumber",
        comment: "Unique order reference number"
    },
    customerName: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    customerPhone: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    customerEmail: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    orderDate: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
    },
    subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
    tax: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    discount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
    paymentMethod: {
        type: Sequelize.ENUM("cash", "card", "mobile_banking", "wallet", "mixed"),
        allowNull: false,
        defaultValue: "cash",
        comment: "Primary payment method or 'mixed' for partial payments"
    },
    tableNumber: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
        comment: "Table number for dine-in orders"
    },
    guestNumber: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: "guest number for dine-in orders"
    },

    specialNotes: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
        comment: "special notes for dine-in orders"
    },
    // Partial payment tracking fields
    cashAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: "Amount paid in cash"
    },
    cardAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: "Amount paid by card"
    },
    walletAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: "Amount paid from wallet"
    },
    paidAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Total amount paid (sum of cash, card, wallet)"
    },
    paymentStatus: {
        type: Sequelize.ENUM("pending", "completed", "failed", "partial"),
        defaultValue: "pending",
        comment: "Payment status: pending, completed, failed, or partial"
    },
    orderStatus: {
        type: Sequelize.ENUM("pending", "processing", "completed", "cancelled"),
        defaultValue: "pending",
    }
});

module.exports = Order;