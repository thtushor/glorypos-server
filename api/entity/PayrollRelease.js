// models/PayrollRelease.js
const Sequelize = require("sequelize");
const sequelize = require("../db");
const User = require("./User");
const UserRole = require("./UserRole");

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
        model: "UserRole", // Updated reference
        key: "id",
      },
      onDelete: "CASCADE",
    },

    // ✅ Salary Month (Handled instead of startDate/endDate)
    salaryMonth: {
      type: Sequelize.STRING, // Format: "2025-01"
      allowNull: false,
      comment: "Salary month in YYYY-MM format",
    },

    // ✅ Base Salary
    baseSalary: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      validate: { min: 0 },
    },

    // ✅ Advance Salary (Rule 1)
    advanceAmount: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },

    // ✅ Bonus Amount (Rule 2)
    bonusAmount: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },

    bonusDescription: {
      type: Sequelize.STRING,
      allowNull: true, // nullable as requested
    },

    // ✅ Loan Deduction (Rule 3)
    loanDeduction: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },

    // ✅ Fine Amount (Rule 5)
    fineAmount: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },

    // ✅ Overtime (Optional but useful)
    overtimeAmount: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },

    // ✅ Other Deductions
    otherDeduction: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },

    // ✅ Final Payable Salary (Auto-calculated & stored)
    netPayableSalary: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      comment: "Final salary after all additions & deductions",
    },

    // ✅ Salary Status
    status: {
      type: Sequelize.ENUM("PENDING", "RELEASED"),
      allowNull: false,
      defaultValue: "PENDING",
    },

    // ✅ Salary Release Date
    releaseDate: {
      type: Sequelize.DATE,
      allowNull: true, // null until released
    },

    // ✅ Who released the salary
    releasedBy: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "User",
        key: "id",
      },
    },

    // ✅ Full Calculation Snapshot (Attendance, overtime, days, etc.)
    calculationSnapshot: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {},
      comment:
        "Full calculation snapshot: attendance, working days, overtime, deductions, etc.",
    },
  },
  {
    tableName: "PayrollReleases",
    timestamps: true,
    indexes: [
      // ✅ Unique index: (userId + salaryMonth)
      {
        unique: true,
        fields: ["userId", "salaryMonth"],
      },
      // Fast lookup by user
      {
        fields: ["userId"],
      },
      {
        fields: ["salaryMonth"],
      },
    ],
  }
);

module.exports = PayrollRelease;
