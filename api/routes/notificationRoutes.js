const express = require('express');
const { NotificationService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');

const router = express.Router();

// Get all stock alerts
router.get('/stock-alerts', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await NotificationService.getStockAlerts(req.user.id);
    res.status(result.status ? 200 : 400).json(result);
}));

// Get unread notification count
router.get('/count', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await NotificationService.getUnreadNotificationCount(req.user.id);
    res.status(result.status ? 200 : 400).json(result);
}));

module.exports = router; 