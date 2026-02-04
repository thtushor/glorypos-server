const express = require('express');
const router = express.Router();
const ThermalPrintService = require('../services/ThermalPrintService');

// Print barcode label
router.post('/barcode', async (req, res) => {
    try {
        const { sku, brandName, categoryName, modelNo, shopName, printerInterface } = req.body;

        if (!sku) {
            return res.status(400).json({ error: 'SKU is required' });
        }

        const result = await ThermalPrintService.printBarcodeLabel({
            sku,
            brandName,
            categoryName,
            modelNo,
            shopName,
            printerInterface
        });

        res.json(result);
    } catch (error) {
        console.error('Print error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test printer connection
router.post('/test-connection', async (req, res) => {
    try {
        const { printerInterface } = req.body;

        if (!printerInterface) {
            return res.status(400).json({ error: 'Printer interface is required' });
        }

        const result = await ThermalPrintService.testConnection(printerInterface);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
