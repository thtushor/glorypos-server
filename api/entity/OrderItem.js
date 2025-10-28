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
    purchasePrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },


});

module.exports = OrderItem; 