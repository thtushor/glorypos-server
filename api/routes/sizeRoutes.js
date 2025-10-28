const express = require('express');
const { SizeService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');

const router = express.Router();

router.post('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const UserId = req?.user?.id || null;
    const result = await SizeService.create({ ...req.body }, UserId);
    res.status(result.status ? 201 : 400).json(result);
}));

router.get('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const UserId = req?.user?.id || null;
    const result = await SizeService.getAll(req.query, UserId);
    res.status(result.status ? 200 : 400).json(result);
}));

router.get('/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const UserId = req?.user?.id || null;
    const result = await SizeService.getById(req.params.id, UserId);
    res.status(result.status ? 200 : 404).json(result);
}));

router.post('/update/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const UserId = req?.user?.id || null;
    const result = await SizeService.update(req.params.id, req.body, UserId);
    res.status(result.status ? 200 : 400).json(result);
}));

router.post('/delete/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const UserId = req?.user?.id || null;
    const result = await SizeService.delete(req.params.id, UserId);
    res.status(result.status ? 200 : 400).json(result);
}));

module.exports = router; 