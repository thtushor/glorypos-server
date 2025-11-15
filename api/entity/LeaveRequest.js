// New model file: LeaveRequest.js - For leave requests (case 6)
const Sequelize = require("sequelize");
const sequelize = require("../db");

const LeaveRequest = sequelize.define("LeaveRequest", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: Sequelize.INTEGER, allowNull: false },
  startDate: { type: Sequelize.DATEONLY, allowNull: false },
  endDate: { type: Sequelize.DATEONLY, allowNull: false },
  type: { type: Sequelize.STRING, allowNull: false }, // e.g., 'sick', 'vacation'
  status: {
    type: Sequelize.ENUM("pending", "approved", "rejected"),
    defaultValue: "pending",
  },
  notes: { type: Sequelize.TEXT },
  approvedBy: { type: Sequelize.INTEGER, allowNull: true },
});

module.exports = LeaveRequest;
