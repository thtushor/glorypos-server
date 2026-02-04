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

// Print KOT
router.post('/kot', async (req, res) => {
    try {
        const { invoiceNumber, tableNumber, guestNumber, date, items, specialNotes, businessName, printerInterface } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Items are required' });
        }

        const result = await ThermalPrintService.printKOT({
            invoiceNumber,
            tableNumber,
            guestNumber,
            date,
            items,
            specialNotes,
            businessName,
            printerInterface
        });

        res.json(result);
    } catch (error) {
        console.error('KOT print error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Print Invoice
router.post('/invoice', async (req, res) => {
    try {
        const { invoiceNumber, tableNumber, guestNumber, date, items, summary, payment, customer, businessInfo, specialNotes, printerInterface } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Items are required' });
        }

        if (!summary || !payment || !customer || !businessInfo) {
            return res.status(400).json({ error: 'Missing required invoice data' });
        }

        const result = await ThermalPrintService.printInvoice({
            invoiceNumber,
            tableNumber,
            guestNumber,
            date,
            items,
            summary,
            payment,
            customer,
            businessInfo,
            specialNotes,
            printerInterface
        });

        res.json(result);
    } catch (error) {
        console.error('Invoice print error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
