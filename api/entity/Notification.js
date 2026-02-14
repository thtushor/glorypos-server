const Sequelize = require("sequelize");
const sequelize = require("../db");

const Notification = sequelize.define(
    "Notification",
    {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        shop_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            },
            comment: "Reference to the shop (user) table",
        },
        title: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        message: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        type: {
            type: Sequelize.ENUM("ORDER_CREATED", "STOCK_LOW", "STOCK_OUT"),
            allowNull: false,
        },
        link: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        reference_id: {
            type: Sequelize.STRING, // Using STRING to be flexible, or INTEGER if IDs are ints
            allowNull: true,
        },
        reference_type: {
            type: Sequelize.ENUM("order", "product"),
            allowNull: true,
        },
        is_read: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        timestamps: true,
        indexes: [
            {
                fields: ["shop_id"],
            },
            {
                fields: ["is_read"],
            },
            {
                fields: ["type"],
            },
        ],
    }
);

module.exports = Notification;
