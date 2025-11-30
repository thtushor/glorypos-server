// models/PayrollRelease.js
const Sequelize = require("sequelize");
const sequelize = require("../db");

const PayrollRelease = sequelize.define(
  "PayrollRelease",
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
        model: "UserRoles", // or "Users" depending on your table name
        key: "id",
      },
      onDelete: "CASCADE",
    },

    // Replaced month with actual date range
    startDate: {
      type: Sequelize.DATEONLY, // Stores "2025-12-01"
      allowNull: false,
    },

    endDate: {
      type: Sequelize.DATEONLY, // Stores "2025-12-31"
      allowNull: false,
    },
    // Type of payout
    releaseType: {
      type: Sequelize.ENUM(
        "FULL",
        "ADVANCE",
        "PARTIAL",
        "BONUS",
        "LOAN_DEDUCTION"
      ),
      allowNull: false,
      defaultValue: "FULL",
      comment:
        "FULL = full month salary, ADVANCE = salary advance, LOAN_DEDUCTION = EMI auto-deducted",
    },

    amount: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    calculationSnapshot: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {},
      comment:
        "Full salary calculation snapshot: attendance, salary days, overtime, deductions.",
    },

    releaseDate: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    },

    releasedBy: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
    },
  },
  {
    tableName: "PayrollReleases",
    timestamps: true,
    indexes: [
      // Prevent duplicate FULL salary release for same user + same period
      {
        unique: true,
        fields: ["userId", "startDate", "endDate", "releaseType"],
        where: {
          releaseType: "FULL",
        },
        name: "unique_full_salary_period",
      },
      // Fast lookup by user
      {
        fields: ["userId"],
      },
      {
        fields: ["startDate", "endDate"],
      },
    ],
  }
);

module.exports = PayrollRelease;
