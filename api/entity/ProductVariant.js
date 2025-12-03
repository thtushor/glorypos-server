const Sequelize = require("sequelize");
const sequelize = require("../db");

const ProductVariant = sequelize.define(
    "ProductVariant",
    {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        sku: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: "variant_sku",
            comment: "Variant SKU",
        },
        quantity: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: "Stock quantity",
        },
        alertQuantity: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 5,
            comment: "Alert when stock reaches this quantity",
        },
        imageUrl: {
            type: Sequelize.STRING,
            allowNull: true,
            comment: "Variant image URL",
        },
        images: {
            type: Sequelize.JSON,
            allowNull: true,
            comment: "Array of variant images URLs",
        },
        status: {
            type: Sequelize.ENUM("active", "inactive"),
            defaultValue: "active",
            comment: "Variant status",
        },
        gender: {
            type: Sequelize.ENUM("men", "women", "others"),
            allowNull: true,
            comment: "Gender category for the product variant",
        },
        modelNo: {
            type: Sequelize.STRING,
            allowNull: true,
            comment: "Model number of the product variant",
        }
    }
);

module.exports = ProductVariant;
