// New model file: PayrollRelease.js - For salary release history (case 5,8)
const Sequelize = require("sequelize");
const sequelize = require("../db");

const PayrollRelease = sequelize.define("PayrollRelease", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: Sequelize.INTEGER, allowNull: false },
  month: { type: Sequelize.STRING, allowNull: false }, // e.g., '2023-11'
  releasedAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
  details: { type: Sequelize.JSON, allowNull: false }, // Breakdown object
  releaseDate: { type: Sequelize.DATE, allowNull: false },
  releasedBy: { type: Sequelize.INTEGER, allowNull: false },
});

module.exports = PayrollRelease;
