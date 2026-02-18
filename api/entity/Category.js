const Sequelize = require("sequelize");
const sequelize = require("../db");

const Category = sequelize.define(
    "Category",
    {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: "Category description",
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
            comment: "Category status",
        },
        barcode: {
            type: Sequelize.STRING,
            allowNull: true,
            comment: "Auto-generated unique barcode for the category",
        }
    },
    {
        indexes: [
            {
                unique: true,
                fields: ['barcode', 'UserId']
            }
        ]
    }
);

module.exports = Category;