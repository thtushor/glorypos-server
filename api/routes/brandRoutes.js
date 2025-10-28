const express = require('express');
const { BrandService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');

const router = express.Router();

router.post('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const UserId = req?.user?.id || null;
    const result = await BrandService.create({ ...req.body }, UserId);
    res.status(result.status ? 201 : 400).json(result);
}));

router.get('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await BrandService.getAll(req.query, req?.user?.id);
    res.status(result.status ? 200 : 400).json(result);
}));

router.get('/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await BrandService.getById(req.params.id, req?.user?.id);
    res.status(result.status ? 200 : 404).json(result);
}));

router.post('/update/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await BrandService.update(req.params.id, req.body, req?.user?.id);
    res.status(result.status ? 200 : 400).json(result);
}));

router.post('/delete/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await BrandService.delete(req.params.id, req?.user?.id);
    res.status(result.status ? 200 : 400).json(result);
}));

module.exports = router; 