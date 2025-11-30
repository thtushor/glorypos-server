// New file: LoanPayment.js - Sequelize Model
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../db");

class LoanPayment extends Model {}

LoanPayment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    loanId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "EmployeeLoans",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "UserRoles",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    paidAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    paymentDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    paidBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
      comment: "ID of the admin who processed the payment.",
    },
  },
  {
    sequelize,
    modelName: "LoanPayment",
    tableName: "LoanPayments",
    timestamps: true,
    indexes: [
      {
        fields: ["loanId"],
      },
      {
        fields: ["employeeId"],
      },
    ],
  }
);

module.exports = LoanPayment;
