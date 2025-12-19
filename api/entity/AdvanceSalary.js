// models/AdvanceSalary.js
const Sequelize = require("sequelize");
const sequelize = require("../db");
const UserRole = require("./UserRole");
const User = require("./User");

const AdvanceSalary = sequelize.define(
    "AdvanceSalary",
    {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: "UserRoles",
                key: "id",
            },
            onDelete: "CASCADE",
        },
        salaryMonth: {
            type: Sequelize.STRING, // Format: "YYYY-MM"
            allowNull: false,
            comment: "Salary month for which advance is taken",
        },
        amount: {
            type: Sequelize.DECIMAL(12, 2),
            allowNull: false,
            validate: { min: 0 },
        },
        reason: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        approvedBy: {
            type: Sequelize.INTEGER,
            allowNull: true, // Can be null if status is PENDING
            references: {
                model: "Users",
                key: "id",
            },
        },
        repaidAmount: {
            type: Sequelize.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0,
            validate: { min: 0 },
            comment: "Amount that has been repaid from salary deductions",
        },
        status: {
            type: Sequelize.ENUM("PENDING", "APPROVED", "REJECTED", "REPAID", "PARTIALLY_REPAID"),
            allowNull: false,
            defaultValue: "PENDING",
        },
    },
    {
        tableName: "AdvanceSalaries",
        timestamps: true,
        indexes: [
            {
                fields: ["userId"],
            },
            {
                fields: ["salaryMonth"],
            },
        ],
    }
);

module.exports = AdvanceSalary;
