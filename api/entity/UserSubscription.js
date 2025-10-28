const Sequelize = require("sequelize");
const sequelize = require("../db");

const UserSubscription = sequelize.define("UserSubscription", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    startDate: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
    },
    endDate: {
        type: Sequelize.DATE,
        allowNull: false,
    },
    status: {
        type: Sequelize.ENUM("active", "expired", "cancelled"),
        defaultValue: "active",
    },
    paymentStatus: {
        type: Sequelize.ENUM("pending", "completed", "failed"),
        defaultValue: "pending",
    },
    paymentMethod: {
        type: Sequelize.ENUM("cash", "card", "mobile_banking"),
        allowNull: false,
    },
    amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
    discount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
    },
    coupon: {
        type: Sequelize.STRING,
        allowNull: true,
    },
});

module.exports = UserSubscription; 