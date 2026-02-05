const express = require('express');
const router = express.Router();
const EscPosService = require('../services/EscPosService');

router.post('/test', async (req, res) => {
    try {
        const { printerType } = req.body;
        const result = await EscPosService.printTest(printerType || 'usb');
        res.json({ success: true, message: result });
    } catch (error) {
        console.error("EscPos Print Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
