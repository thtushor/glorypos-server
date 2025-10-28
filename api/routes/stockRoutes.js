const express = require('express');
const { StockService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');

const router = express.Router();

router.post('/adjust', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await StockService.adjustStock(req.body, req.user.id);
    res.status(result.status ? 200 : 400).json(result);
}));

router.get('/history', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await StockService.getStockHistory(req.query, req.user.id);
    res.status(result.status ? 200 : 400).json(result);
}));

router.get('/current', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await StockService.getCurrentStock(
        req.query.productId,
        req.query.variantId,
        req.user.id
    );
    res.status(result.status ? 200 : 400).json(result);
}));

module.exports = router; 