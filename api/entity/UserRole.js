const Sequelize = require("sequelize");
const sequelize = require("../db");

const UserRole = sequelize.define("UserRole", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    fullName: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: "user-role-email",
        validate: {
            isEmail: true,
        },
    },
    phone: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    role: {
        type: Sequelize.ENUM("manager", "staff", "cashier"),
        allowNull: false,
        default: "staff"
    },
    status: {
        type: Sequelize.ENUM("active", "inactive"),
        defaultValue: "active",
    },
    permissions: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: {},
        comment: "Store role-specific permissions",
    },
});

module.exports = UserRole;


