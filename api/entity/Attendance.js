// New model file: Attendance.js - For daily attendance (case 4,6)
const Sequelize = require("sequelize");
const sequelize = require("../db");

const Attendance = sequelize.define(
  "Attendance",
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: Sequelize.INTEGER, allowNull: false }, // userrole.id
    date: { type: Sequelize.DATEONLY, allowNull: false },

    // TYPE: "present" or "absent"
    type: {
      type: Sequelize.ENUM("present", "absent"),
      allowNull: false,
    },
    lateMinutes: { type: Sequelize.INTEGER, defaultValue: 0 },
    extraMinutes: { type: Sequelize.INTEGER, defaultValue: 0 },
    isHalfDay: { type: Sequelize.BOOLEAN, defaultValue: false },
    isFullAbsent: { type: Sequelize.BOOLEAN, defaultValue: false },

    // Absent-specific
    reason: { type: Sequelize.STRING, defaultValue: null },
    notes: { type: Sequelize.STRING, defaultValue: null },
  },
  {
    indexes: [
      { unique: true, fields: ["userId", "date"] },
      { fields: ["type"] },
    ],
  }
);

module.exports = Attendance;
