// Updated UserRole.js - Added baseSalary and requiredDailyHours fields. Also added parentUserId which was referenced in service but not in model (assuming it was missing).
const Sequelize = require("sequelize");
const sequelize = require("../db");

const UserRole = sequelize.define("UserRole", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  fullName: { type: Sequelize.STRING, allowNull: false },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: "user-role-email",
    validate: { isEmail: true },
  },
  phone: { type: Sequelize.STRING, allowNull: true },
  password: { type: Sequelize.STRING, allowNull: false },
  role: {
    type: Sequelize.ENUM("manager", "staff", "cashier"),
    allowNull: false,
    defaultValue: "staff",
  },
  status: {
    type: Sequelize.ENUM("active", "inactive"),
    defaultValue: "active",
  },
  imageUrl: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },
  permissions: {
    type: Sequelize.JSON,
    allowNull: false,
    defaultValue: {},
    comment: "Store role-specific permissions",
  },
  parentUserId: { type: Sequelize.INTEGER, allowNull: false }, // Added this as it's used in service
  baseSalary: { type: Sequelize.DECIMAL(10, 2), allowNull: true }, // Added for current base salary (monthly)
  requiredDailyHours: { type: Sequelize.INTEGER, allowNull: true }, // Added for daily required hours
});

module.exports = UserRole;
