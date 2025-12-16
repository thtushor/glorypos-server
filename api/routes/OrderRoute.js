const express = require('express');
const { OrderService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');
const { addShopAccess } = require('../middleware/shopAccessMiddleware');

const router = express.Router();

// Create new order
router.post('/', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await OrderService.create(req.body, req.user.id, req.accessibleShopIds);
    res.status(result.status ? 201 : 400).json(result);
}));

// Get customer order history
router.get('/customer/:customerId', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await OrderService.getCustomerOrders(req.params.customerId, req.accessibleShopIds);
    res.status(result.status ? 200 : 400).json(result);
}));

// Get  order history
router.get('/', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await OrderService.getAll(req?.query, req.accessibleShopIds);
    res.status(result.status ? 200 : 400).json(result);
}));


// Get  order history
router.get('/:orderId', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await OrderService.getById(req?.params.orderId, req.accessibleShopIds);
    res.status(result.status ? 200 : 400).json(result);
}));

// Get dashboard statistics
router.get('/dashboard', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await OrderService.getDashboardStats(req.accessibleShopIds, req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

// Get sales report
router.get('/report/sales', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await OrderService.getSalesReport(req.accessibleShopIds, req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

// Generate invoice for an order
router.get('/:orderId/invoice', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await OrderService.generateInvoice(req.params.orderId, req.accessibleShopIds);
    res.status(result.status ? 200 : 404).json(result);
}));

// Get top selling items
router.get('/report/top-items', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await OrderService.getTopSellingItems(req.accessibleShopIds, req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

// Get top customers
router.get('/report/top-customers', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await OrderService.getTopCustomers(req.accessibleShopIds, req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

// Get sales chart data
router.get('/report/chart/sales', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await OrderService.getSalesChartData(req.accessibleShopIds, req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

// Sales & Inventory intelligence dashboard
router.get('/report/sales-inventory', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const result = await OrderService.getSalesInventoryDashboard(req.accessibleShopIds, req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

module.exports = router;