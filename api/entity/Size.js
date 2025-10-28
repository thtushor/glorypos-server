const Sequelize = require("sequelize");
const sequelize = require("../db");

const Size = sequelize.define(
    "Size",
    {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Size name",
            defaultValue: "",
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: "Size description",
            defaultValue: "",
        },
        status: {
            type: Sequelize.ENUM("active", "inactive"),
            defaultValue: "active",
            comment: "Size status",
        }
    }
);

module.exports = Size;