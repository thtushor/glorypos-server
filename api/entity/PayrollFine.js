// models/PayrollFine.js
const Sequelize = require("sequelize");
const sequelize = require("../db");

const PayrollFine = sequelize.define(
    "PayrollFine",
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
                model: "Users",
                key: "id",
            },
            onDelete: "CASCADE",
        },
        salaryMonth: {
            type: Sequelize.STRING, // Format: "YYYY-MM"
            allowNull: false,
            comment: "Salary month for which fine is applied",
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
    },
    {
        tableName: "PayrollFines",
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

module.exports = PayrollFine;
