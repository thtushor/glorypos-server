const express = require('express');
const { ProductService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');
const subscriptionLimits = require('../middleware/subscriptionLimits');

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

router.get('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await ProductService.getAll(req.query, req.user.id);
    res.status(result.status ? 200 : 400).json(result);
}));

router.get('/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await ProductService.getById(req.params.id, req.user.id);
    res.status(result.status ? 200 : 404).json(result);
}));

router.post('/update/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await ProductService.update(req.params.id, req.body, req.user.id);
    res.status(result.status ? 200 : 400).json(result);
}));

router.post('/delete/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await ProductService.delete(req.params.id, req.user.id);
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