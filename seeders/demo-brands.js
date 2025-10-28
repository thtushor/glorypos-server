'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const brands = [
            { name: "Coca-Cola", description: "Global beverage company", status: "active" },
            { name: "Nestlé", description: "Multinational food and drink company", status: "active" },
            { name: "PepsiCo", description: "Beverages and snacks manufacturer", status: "active" },
            { name: "Kellogg's", description: "Breakfast cereals and convenience foods", status: "active" },
            { name: "Unilever", description: "Consumer goods manufacturer", status: "active" },
            { name: "P&G", description: "Personal care and household products", status: "active" },
            { name: "Mars", description: "Confectionery and pet food manufacturer", status: "active" },
            { name: "Danone", description: "Dairy products and beverages", status: "active" },
            { name: "Kraft Heinz", description: "Food processing company", status: "active" },
            { name: "General Mills", description: "Food products manufacturer", status: "active" },
            { name: "Johnson & Johnson", description: "Personal care products", status: "active" },
            { name: "Colgate-Palmolive", description: "Personal care products", status: "active" },
            { name: "Mondelez", description: "Snacks and confectionery", status: "active" },
            { name: "Red Bull", description: "Energy drinks manufacturer", status: "active" },
            { name: "Ferrero", description: "Chocolate and confectionery", status: "active" },
            { name: "Campbell's", description: "Processed food and snacks", status: "active" },
            { name: "Tyson Foods", description: "Meat and poultry products", status: "active" },
            { name: "Hershey's", description: "Chocolate and confectionery", status: "active" },
            { name: "Del Monte", description: "Processed food products", status: "active" },
            { name: "Quaker", description: "Grain-based food products", status: "active" },
            { name: "Lipton", description: "Tea and beverages", status: "active" },
            { name: "Dove", description: "Personal care products", status: "active" },
            { name: "Lay's", description: "Snack foods", status: "active" },
            { name: "Nescafé", description: "Coffee products", status: "active" },
            { name: "Cadbury", description: "Chocolate and confectionery", status: "active" },
            { name: "Knorr", description: "Food and beverage products", status: "active" },
            { name: "Doritos", description: "Snack foods", status: "active" },
            { name: "Pampers", description: "Baby care products", status: "active" },
            { name: "Gillette", description: "Personal care products", status: "active" },
            { name: "Maggi", description: "Instant food products", status: "active" }
        ].map(brand => ({
            ...brand,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        await queryInterface.bulkInsert('Brands', brands, {});
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('Brands', null, {});
    }
}; 