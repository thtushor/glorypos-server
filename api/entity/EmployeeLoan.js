// New file: EmployeeLoan.js - Sequelize Model
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../db");

class EmployeeLoan extends Model {}

EmployeeLoan.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "UserRoles",
        key: "id",
      },
      onDelete: "CASCADE",
      comment: "Foreign key to the UserRoles table.",
    },
    principalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: "The initial amount of the loan.",
    },
    interestRate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
      comment: "Annual interest rate (e.g., 0.05 for 5%).",
    },
    totalPayableAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: "Principal + interest.",
    },
    monthlyEMI: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: "Equated Monthly Installment.",
    },
    remainingBalance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: "The outstanding amount to be paid.",
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "COMPLETED"),
      allowNull: false,
      defaultValue: "ACTIVE",
      comment: "Loan status.",
    },
  },
  {
    sequelize,
    modelName: "EmployeeLoan",
    tableName: "EmployeeLoans",
    timestamps: true,
    indexes: [
      {
        fields: ["employeeId"],
      },
      {
        fields: ["status"],
      },
    ],
  }
);

module.exports = EmployeeLoan;
