const Sequelize = require("sequelize");
const sequelize = require("../db");

// Brand Model
const Brand = sequelize.define("Brand", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "Brand name",
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Brand description",
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
        comment: "Brand status",
    },
});



module.exports = Brand;