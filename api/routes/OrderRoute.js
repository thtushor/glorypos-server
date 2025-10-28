const express = require('express');
const { OrderService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');

const router = express.Router();

// Create new order
router.post('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await OrderService.create(req.body, req.user.id);
    res.status(result.status ? 201 : 400).json(result);
}));

// Get customer order history
router.get('/customer/:customerId', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await OrderService.getCustomerOrders(req.params.customerId, req.user.id);
    res.status(result.status ? 200 : 400).json(result);
}));

// Get  order history
router.get('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await OrderService.getAll(req?.query, req.user.id);
    res.status(result.status ? 200 : 400).json(result);
}));

// Get dashboard statistics
router.get('/dashboard', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await OrderService.getDashboardStats(req.user.id, req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

// Get sales report
router.get('/report/sales', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await OrderService.getSalesReport(req.user.id, req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

// Generate invoice for an order
router.get('/:orderId/invoice', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await OrderService.generateInvoice(req.params.orderId, req.user.id);
    res.status(result.status ? 200 : 404).json(result);
}));

// Get top selling items
router.get('/report/top-items', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await OrderService.getTopSellingItems(req.user.id, req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

// Get top customers
router.get('/report/top-customers', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await OrderService.getTopCustomers(req.user.id, req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

// Get sales chart data
router.get('/report/chart/sales', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await OrderService.getSalesChartData(req.user.id, req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

module.exports = router;