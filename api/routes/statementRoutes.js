const express = require('express');
const { StatementService, AuthService } = require('../services');
const router = express.Router();

// Middleware for consistent API responses
const requestHandler = (message, handler) => async (req, res) => {
    try {
        const result = await handler(req, res);
        res.status(result.status ? 200 : 400).json(result);
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

router.get('/products', AuthService.authenticate, requestHandler(null, async (req) => {
    return await StatementService.getProductStatements(req.query);
}));

router.get('/products/:productId', AuthService.authenticate, requestHandler(null, async (req) => {
    return await StatementService.getSpecificProductStatement(req.params.productId, req.query);
}));

router.get('/daily', AuthService.authenticate, requestHandler(null, async (req) => {
    return await StatementService.getDailySummary(req.query);
}));

module.exports = router;
