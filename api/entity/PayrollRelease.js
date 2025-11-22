// models/PayrollRelease.js
const Sequelize = require("sequelize");
const sequelize = require("../db");

const PayrollRelease = sequelize.define(
  "PayrollRelease",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "UserRoles", // or "Users" depending on your table name
        key: "id",
      },
      onDelete: "CASCADE",
    },

    // Replaced month with actual date range
    startDate: {
      type: Sequelize.DATEONLY, // Stores "2025-12-01"
      allowNull: false,
    },

    endDate: {
      type: Sequelize.DATEONLY, // Stores "2025-12-31"
      allowNull: false,
    },

    releasedAmount: {
      type: Sequelize.DECIMAL(12, 2), // Increased precision for safety
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    details: {
      type: Sequelize.JSON,
      allowNull: true, // Can be null if you want minimal logging
      defaultValue: {},
      comment:
        "Full salary calculation snapshot: working days, absent hours, etc.",
    },

    releaseDate: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    },

    releasedBy: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
    },
  },
  {
    tableName: "PayrollReleases",
    timestamps: true,
    indexes: [
      // Prevent duplicate salary release for same user + same period
      {
        unique: true,
        fields: ["userId", "startDate", "endDate"],
        name: "unique_user_salary_period",
      },
      // Fast lookup by user
      {
        fields: ["userId"],
      },
      {
        fields: ["startDate", "endDate"],
      },
    ],
  }
);

module.exports = PayrollRelease;
