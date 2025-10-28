'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const units = [
            { name: "Kilogram", shortName: "kg", status: "active" },
            { name: "Gram", shortName: "g", status: "active" },
            { name: "Liter", shortName: "L", status: "active" },
            { name: "Milliliter", shortName: "ml", status: "active" },
            { name: "Piece", shortName: "pc", status: "active" },
            { name: "Dozen", shortName: "dz", status: "active" },
            { name: "Pack", shortName: "pk", status: "active" },
            { name: "Box", shortName: "box", status: "active" },
            { name: "Carton", shortName: "ctn", status: "active" },
            { name: "Bottle", shortName: "btl", status: "active" },
            { name: "Can", shortName: "can", status: "active" },
            { name: "Sachet", shortName: "sct", status: "active" },
            { name: "Bag", shortName: "bag", status: "active" },
            { name: "Bundle", shortName: "bdl", status: "active" },
            { name: "Roll", shortName: "roll", status: "active" }
        ].map(unit => ({
            ...unit,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        await queryInterface.bulkInsert('Units', units, {});
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('Units', null, {});
    }
}; 