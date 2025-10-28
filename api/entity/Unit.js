const Sequelize = require("sequelize");
const sequelize = require("../db");

const Unit = sequelize.define(
    "Unit",
    {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Unit name (e.g., kg, piece, dozen)",
        },
        shortName: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Short form of unit (e.g., kg, pcs, dz)",
        },
        // UserId: {
        //     type: Sequelize.INTEGER,
        //     allowNull: false,
        //     references: {
        //         model: 'Users',
        //         key: 'id'
        //     },
        //     comment: "Reference to the user table",
        // },
        status: {
            type: Sequelize.ENUM("active", "inactive"),
            defaultValue: "active",
            comment: "Unit status",
        }
    }
);

module.exports = Unit;