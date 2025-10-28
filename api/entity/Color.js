const Sequelize = require("sequelize");
const sequelize = require("../db");

const Color = sequelize.define(
    "Color",
    {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Color name",
        },
        code: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Color hex code",
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: "Color description",
        },
        status: {
            type: Sequelize.ENUM("active", "inactive"),
            defaultValue: "active",
            comment: "Color status",
        }
    }
);

module.exports = Color;