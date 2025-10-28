'use strict';
const bcrypt = require("bcrypt");

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.bulkInsert(
            "Users",
            [{
                fullName: "Fashion GLory",
                email: "fs@example.com",
                phoneNumber: "0180000000",
                location: "New York, USA",
                businessName: "John's Cafe",
                businessType: "Food & Beverages",
                password: await bcrypt.hash("SecurePassword123", 10), // Ensure the password is hashed
                accountStatus: "active", // Default or "inactive"
                isVerified: true,
                verificationToken: "exampleVerificationToken123", // Set this as needed
                isLoggedIn: false, // Default
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                fullName: "John Doe",
                email: "demo8@example.com",
                phoneNumber: "12345567890",
                location: "New York, USA",
                businessName: "John's Cafe",
                businessType: "Food & Beverages",
                password: await bcrypt.hash("SecurePassword123", 10), // Ensure the password is hashed
                accountStatus: "active", // Default or "inactive"
                isVerified: true,
                verificationToken: "exampleVerificationToken123", // Set this as needed
                isLoggedIn: false, // Default
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                fullName: "Jane Smith",
                email: "jane.smith@example.com",
                phoneNumber: "0987654321",
                location: "Los Angeles, USA",
                businessName: "Smith Supplies",
                businessType: "Retail",
                password: await bcrypt.hash("AnotherSecurePassword456", 10), // Ensure the password is hashed
                accountStatus: "inactive",
                isVerified: false,
                verificationToken: null,
                isLoggedIn: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            ],
            {}
        );
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete("Users", null, {});
    },
};



// 1. npx sequelize-cli init
// 2. npx sequelize-cli db:migrate
// 3. npx sequelize-cli migration:generate --name create-user
// 4. npx sequelize-cli db:seed:all
//npx sequelize-cli db:seed --seed 20240320000001-demo-categories.js
//npx sequelize-cli db:seed --seed 20240320000002-demo-brands.js
//npx sequelize-cli db:seed --seed 20240320000003-demo-units.js
//npx sequelize-cli db:seed --seed 20240320000004-demo-products.js