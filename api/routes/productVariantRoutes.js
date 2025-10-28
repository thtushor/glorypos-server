const express = require('express');
const { ProductVariantService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');

const router = express.Router();

router.post('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const UserId = req?.user?.id || null;
    const result = await ProductVariantService.create(req.body, UserId);
    res.status(result.status ? 201 : 400).json(result);
}));

router.get('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const UserId = req?.user?.id || null;
    const result = await ProductVariantService.getAll(req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

router.get('/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await ProductVariantService.getById(req.params.id);
    res.status(result.status ? 200 : 404).json(result);
}));

router.post('/update/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await ProductVariantService.update(req.params.id, req.body);
    res.status(result.status ? 200 : 400).json(result);
}));

router.post('/stock/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await ProductVariantService.updateStock(req.params.id, req.body.quantity);
    res.status(result.status ? 200 : 400).json(result);
}));

router.post('/delete/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await ProductVariantService.delete(req.params.id);
    res.status(result.status ? 200 : 400).json(result);
}));

module.exports = router; 