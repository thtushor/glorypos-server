const Sequelize = require("sequelize");
const sequelize = require("../db");

const StockHistory = sequelize.define("StockHistory", {
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

});

module.exports = StockHistory; 