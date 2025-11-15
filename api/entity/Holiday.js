// New model file: Holiday.js - For holidays (case 7)
const Sequelize = require("sequelize");
const sequelize = require("../db");

const Holiday = sequelize.define("Holiday", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  date: { type: Sequelize.DATEONLY, allowNull: false },
  description: { type: Sequelize.STRING, allowNull: false },
});

module.exports = Holiday;
