const express = require('express');
const { ProductService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');
const subscriptionLimits = require('../middleware/subscriptionLimits');
const { addShopAccess } = require('../middleware/shopAccessMiddleware');

const router = express.Router();

router.post('/',
    AuthService.authenticate,
    subscriptionLimits.checkSubscriptionStatus,
    subscriptionLimits.checkProductLimit,
    requestHandler(null, async (req, res) => {
        const result = await ProductService.create(req.body, req.user.id);
        res.status(result.status ? 201 : 400).json(result);
    })
);

router.get('/', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await ProductService.getAll(req.query, req.accessibleShopIds);
    res.status(result.status ? 200 : 400).json(result);
}));

// Public route for performance testing with logging
router.get('/public-list', requestHandler(null, async (req, res) => {
    const startTime = Date.now();
    const logMessage = `[${new Date().toISOString()}] GET /api/products/public-list - Query: ${JSON.stringify(req.query)}\n`;
    
    // Log to console
    console.log(logMessage.trim());
    
    // Log to file
    const fs = require('fs');
    const path = require('path');
    const logDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }
    fs.appendFileSync(path.join(logDir, 'performance_test.log'), logMessage);

    const result = await ProductService.getAll(req.query, null);
    
    const duration = Date.now() - startTime;
    const endLog = `[${new Date().toISOString()}] Completed /public-list in ${duration}ms\n`;
    console.log(endLog.trim());
    fs.appendFileSync(path.join(logDir, 'performance_test.log'), endLog);

    res.status(result.status ? 200 : 400).json(result);
}));



router.get('/:id', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await ProductService.getById(req.params.id, req.accessibleShopIds);
    res.status(result.status ? 200 : 404).json(result);
}));

router.post('/update/:id', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await ProductService.update(req.params.id, req.body, req.accessibleShopIds);
    res.status(result.status ? 200 : 400).json(result);
}));

router.post('/delete/:id', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await ProductService.delete(req.params.id, req.accessibleShopIds);
    res.status(result.status ? 200 : 400).json(result);
}));

// For image uploads
router.post('/upload-image',
    AuthService.authenticate,
    subscriptionLimits.checkSubscriptionStatus,
    subscriptionLimits.checkStorageLimit,
    requestHandler(null, async (req, res) => {
        // Your image upload logic
    })
);

module.exports = router; 