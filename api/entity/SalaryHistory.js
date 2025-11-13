// New model file: SalaryHistory.js - For tracking salary changes (case 3,8)
const Sequelize = require("sequelize");
const sequelize = require("../db");

const SalaryHistory = sequelize.define("SalaryHistory", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: Sequelize.INTEGER, allowNull: false },
  salary: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
  startDate: { type: Sequelize.DATEONLY, allowNull: false }, // Effective start date (first day of month for promotions)
  status: {
    type: Sequelize.ENUM("initial", "promotion", "demotion"),
    allowNull: false,
    defaultValue: "initial",
  },
  previousSalary: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
});

module.exports = SalaryHistory;
