'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const categories = [
            { name: "Beverages", description: "Drinks and liquid refreshments", status: "active" },
            { name: "Dairy Products", description: "Milk and dairy-based products", status: "active" },
            { name: "Snacks", description: "Quick bites and packaged snacks", status: "active" },
            { name: "Bakery", description: "Fresh baked goods", status: "active" },
            { name: "Fruits", description: "Fresh fruits and dried fruits", status: "active" },
            { name: "Vegetables", description: "Fresh and frozen vegetables", status: "active" },
            { name: "Meat & Poultry", description: "Fresh and frozen meat products", status: "active" },
            { name: "Seafood", description: "Fresh and frozen seafood", status: "active" },
            { name: "Grains & Cereals", description: "Rice, wheat, and breakfast cereals", status: "active" },
            { name: "Condiments", description: "Sauces, spreads, and dressings", status: "active" },
            { name: "Canned Foods", description: "Preserved and canned items", status: "active" },
            { name: "Frozen Foods", description: "Ready-to-cook frozen items", status: "active" },
            { name: "Personal Care", description: "Hygiene and personal care items", status: "active" },
            { name: "Household", description: "Cleaning and household items", status: "active" },
            { name: "Baby Care", description: "Baby food and care products", status: "active" },
            { name: "Pet Supplies", description: "Pet food and accessories", status: "active" },
            { name: "Health & Wellness", description: "Vitamins and health supplements", status: "active" },
            { name: "Organic Foods", description: "Certified organic products", status: "active" },
            { name: "International Foods", description: "Imported and ethnic foods", status: "active" },
            { name: "Breakfast Foods", description: "Morning meal essentials", status: "active" },
            { name: "Pasta & Noodles", description: "Various types of pasta products", status: "active" },
            { name: "Oils & Ghee", description: "Cooking oils and clarified butter", status: "active" },
            { name: "Spices & Seasonings", description: "Cooking spices and seasonings", status: "active" },
            { name: "Chocolates", description: "Chocolate bars and confectionery", status: "active" },
            { name: "Coffee & Tea", description: "Hot beverage products", status: "active" },
            { name: "Nuts & Dry Fruits", description: "Assorted nuts and dried fruits", status: "active" },
            { name: "Ready-to-Eat", description: "Instant and ready-made meals", status: "active" },
            { name: "Baking Supplies", description: "Baking ingredients and tools", status: "active" },
            { name: "Energy Drinks", description: "Sports and energy beverages", status: "active" },
            { name: "Disposables", description: "Disposable items and packaging", status: "active" }
        ].map(category => ({
            ...category,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        await queryInterface.bulkInsert('Categories', categories, {});
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('Categories', null, {});
    }
}; 