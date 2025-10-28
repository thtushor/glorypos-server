const Sequelize = require("sequelize");
const sequelize = require("../db");

const User = sequelize.define(
    "User", // Model name is singular to follow Sequelize conventions
    {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        fullName: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Name of the user or shop owner",
        },
        email: {
            type: Sequelize.STRING(100),
            allowNull: false,
            unique: "email",
            validate: {
                isEmail: true,
            },
        },
        image: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        phoneNumber: {
            type: Sequelize.STRING(50),
            allowNull: false,
            unique: "phoneNumber",
            comment: "Phone number of the user",
        },
        location: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "User's location",
        },
        businessName: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Name of the user's business",
        },
        businessType: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Type of business the user runs",
        },
        password: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Hashed password of the user",
        },
        accountStatus: {
            type: Sequelize.ENUM("active", "inactive"),
            allowNull: false,
            defaultValue: "inactive",
            comment: "Status of the user account",
        },
        accountType: {
            type: Sequelize.ENUM("super admin", "shop"),
            defaultValue: "shop"
        },
        isVerified: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: "Indicates if the user is email verified",
        },
        verificationToken: {
            type: Sequelize.STRING,
            allowNull: true,
            comment: "Token for email verification",
        },
        resetTokenExpiry: {
            type: Sequelize.DATE,
            defaultValue: null
        },
        resetToken: {
            type: Sequelize.STRING,
            defaultValue: null
        },
        isLoggedIn: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: "Tracks if the user is currently logged in",
        },
        parent_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id'
            },
            comment: "Foreign key to parent user (shop). Null means this is a parent shop.",
        },

    }
);

module.exports = User;
