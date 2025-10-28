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
        type: Sequelize.ENUM("cash", "card", "mobile_banking"),
        allowNull: false,
    },
    paymentStatus: {
        type: Sequelize.ENUM("pending", "completed", "failed"),
        defaultValue: "pending",
    },
    orderStatus: {
        type: Sequelize.ENUM("pending", "processing", "completed", "cancelled"),
        defaultValue: "pending",
    }
});

module.exports = Order;