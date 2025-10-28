const Sequelize = require("sequelize");
const sequelize = require("../db");

const Coupon = sequelize.define("Coupon", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: "coupon_code",
    },
    type: {
        type: Sequelize.ENUM("percentage", "fixed"),
        allowNull: false,
        defaultValue: "percentage",
    },
    value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: "Discount amount or percentage",
    },
    maxUses: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    usedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    startDate: {
        type: Sequelize.DATE,
        allowNull: false,
    },
    endDate: {
        type: Sequelize.DATE,
        allowNull: false,
    },
    minPurchaseAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
    },
    maxDiscountAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
    },
    status: {
        type: Sequelize.ENUM("active", "inactive", "expired"),
        defaultValue: "active",
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true,
    }
});

module.exports = Coupon; 