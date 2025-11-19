// models/Holiday.js
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Holiday = sequelize.define(
  "Holiday",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "start_date",
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "end_date",
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "created_by",
      comment: "Admin (User) who added this holiday",
    },
  },
  {
    tableName: "holidays",
    timestamps: true,
  }
);

// Validation: endDate >= startDate
Holiday.addHook("beforeValidate", (holiday) => {
  if (
    holiday.startDate &&
    holiday.endDate &&
    holiday.startDate > holiday.endDate
  ) {
    throw new Error("endDate cannot be earlier than startDate");
  }
});

module.exports = Holiday;
