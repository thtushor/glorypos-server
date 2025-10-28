const Sequelize = require("sequelize");
const sequelize = require("../db");

const Product = sequelize.define(
    "Product",
    {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        code: {
            type: Sequelize.STRING,
            allowNull: true,
            unique: "product_code",
            comment: "Barcode or unique code for the product",
        },
        sku: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: "sku_code",
            comment: "unique code for the product",
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Name of the product",
        },
        // categoryId: {
        //     type: Sequelize.INTEGER,
        //     allowNull: false,
        //     references: {
        //         model: 'Categories',
        //         key: 'id'
        //     },
        //     comment: "Reference to the category table",
        // },
        // brandId: {
        //     type: Sequelize.INTEGER,
        //     allowNull: false,
        //     references: {
        //         model: 'Brands',
        //         key: 'id'
        //     },
        //     comment: "Reference to the brand table",
        // },
        // unitId: {
        //     type: Sequelize.INTEGER,
        //     allowNull: false,
        //     references: {
        //         model: 'Units',
        //         key: 'id'
        //     },
        //     comment: "Reference to the unit table",
        // },
        description: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: "Product description",
        },
        alertQuantity: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 10,
            comment: "Quantity at which to alert for low stock",
        },
        productImage: {
            type: Sequelize.STRING,
            allowNull: true,
            comment: "Path or URL of the product image",
        },
        discountType: {
            type: Sequelize.ENUM("percentage", "amount"),
            allowNull: true,
            comment: "Type of discount applied to the product",
        },
        discountAmount: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
            comment: "Discount amount based on the discount type",
        },
        purchasePrice: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            comment: "Purchase price of the product",
        },
        salesPrice: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            comment: "Sales price of the product",
        },
        vat: {
            type: Sequelize.DECIMAL(5, 2),
            allowNull: true,
            defaultValue: 0,
            comment: "VAT percentage on the product",
        },
        price: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            comment: "Maximum retail price of the product",
        },
        stock: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: "Current stock quantity",
        },
        status: {
            type: Sequelize.ENUM("active", "inactive"),
            defaultValue: "active",
            comment: "Product status",
        },

        // UserId: {
        //     type: Sequelize.INTEGER,
        //     allowNull: false,
        //     references: {
        //         model: 'Users',
        //         key: 'id'
        //     },
        //     comment: "Reference to the user table",
        // }
    }
);

module.exports = Product;