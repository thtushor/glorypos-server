const Sequelize = require("sequelize");
const sequelize = require("../db");

const StuffCommission = sequelize.define(
  "StuffCommission",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    baseAmount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      comment: "Order total used to calculate commission",
    },
    commissionAmount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      comment: "Final commission amount paid to staff",
    },
    commissionPercentage: {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      comment: "Percentage applied from shop settings",
      defaultValue: 0,
    },
    notes: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "stuffCommissions",
  }
);

module.exports = StuffCommission;


