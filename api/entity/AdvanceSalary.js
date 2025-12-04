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
                model: "UserRole",
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
                model: "User",
                key: "id",
            },
        },
        status: {
            type: Sequelize.ENUM("PENDING", "APPROVED", "REJECTED"),
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
