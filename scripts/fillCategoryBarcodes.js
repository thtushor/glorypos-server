const { Category } = require('../api/entity');
const { Op } = require('sequelize');
const sequelize = require('../api/db');

/**
 * Generate a unique barcode for category (Re-implemented for the script)
 */
async function generateUniqueBarcode(userId, prefix = 'CAT', length = 6) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let barcode;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 50;

    while (!isUnique && attempts < maxAttempts) {
        const randomPart = Array.from({ length }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('');

        barcode = `${prefix}-${randomPart}`;

        const existing = await Category.findOne({
            where: {
                barcode,
                UserId: userId
            },
            attributes: ['id']
        });

        if (!existing) {
            isUnique = true;
        }
        attempts++;
    }

    if (!isUnique) {
        barcode = `${prefix}-${Date.now().toString().slice(-6)}`;
    }

    return barcode;
}

async function fillMissingBarcodes() {
    try {
        console.log('Starting barcode replenishment for categories...');

        // Find categories where barcode is null or empty string
        const categories = await Category.findAll({
            where: {
                [Op.or]: [
                    { barcode: null },
                    { barcode: '' }
                ]
            }
        });

        console.log(`Found ${categories.length} categories with missing barcodes.`);

        let updatedCount = 0;
        for (const category of categories) {
            const newBarcode = await generateUniqueBarcode(category.UserId);
            await category.update({ barcode: newBarcode });
            updatedCount++;
            console.log(`Updated Category ID ${category.id}: ${category.name} -> ${newBarcode}`);
        }

        console.log(`Successfully updated ${updatedCount} categories.`);
        process.exit(0);
    } catch (error) {
        console.error('Error updating barcodes:', error);
        process.exit(1);
    }
}

// Run the script
fillMissingBarcodes();
