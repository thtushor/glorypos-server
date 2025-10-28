const Sequelize = require("sequelize");
const sequelize = require("../db");

const SubscriptionPlan = sequelize.define("SubscriptionPlan", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: "plan_name",
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
    duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Duration in days",
    },
    features: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
    },
    maxProducts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    maxStorage: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: "1 GB",
    },
    maxUsers: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    status: {
        type: Sequelize.ENUM("active", "inactive"),
        defaultValue: "active",
    }
});

module.exports = SubscriptionPlan; 