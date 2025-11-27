const Sequelize = require("sequelize");
const sequelize = require("../db");

const OrderItem = sequelize.define("OrderItem", {
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

    originalUnitPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Original unit price of the product",
    },

    purchasePrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },

    discountType: {
        type: Sequelize.ENUM("percentage", "amount"),
        allowNull: true,
        comment: "Type of discount applied to the product",
    },
    unitDiscount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Discount given per unit",
    },

    discountAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Discount given per unit",
    },

    totalDiscount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Total discount for this order item",
    },


});

module.exports = OrderItem; 