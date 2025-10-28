const express = require('express');
const { SubscriptionService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');

const router = express.Router();

// Admin routes
router.post('/plans', AuthService.authenticate, AuthService.isAdmin, requestHandler(null, async (req, res) => {
    const result = await SubscriptionService.createPlan(req.body);
    res.status(result.status ? 201 : 400).json(result);
}));

router.post('/plans/:id', AuthService.authenticate, AuthService.isAdmin, requestHandler(null, async (req, res) => {
    const result = await SubscriptionService.updatePlan(req.params.id, req.body);
    res.status(result.status ? 200 : 400).json(result);
}));

router.post('/plans/delete/:id', AuthService.authenticate, AuthService.isAdmin, requestHandler(null, async (req, res) => {
    const result = await SubscriptionService.deletePlan(req.params.id);
    res.status(result.status ? 200 : 400).json(result);
}));

// Public routes
router.get('/plans', requestHandler(null, async (req, res) => {
    const result = await SubscriptionService.getAllPlans(req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

router.get('/plans/:id', requestHandler(null, async (req, res) => {
    const result = await SubscriptionService.getPlanById(req.params.id);
    res.status(result.status ? 200 : 404).json(result);
}));

// User routes
router.post('/subscribe', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await SubscriptionService.subscribeToPlan(req.user.id, req.body);
    res.status(result.status ? 200 : 400).json(result);
}));

router.get('/my-subscription', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await SubscriptionService.getUserSubscription(req.user.id);
    res.status(result.status ? 200 : 400).json(result);
}));

// Admin route to get all subscriptions
router.get('/all', AuthService.authenticate, AuthService.isAdmin, requestHandler(null, async (req, res) => {
    const result = await SubscriptionService.getAllUserSubscriptions(req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

// Admin route to update subscription payment
router.post('/payment/:id', AuthService.authenticate, AuthService.isAdmin, requestHandler(null, async (req, res) => {
    const result = await SubscriptionService.updateSubscriptionPayment(req.params.id, req.body);
    res.status(result.status ? 200 : 400).json(result);
}));

// Check specific subscription status
router.get('/status/:id', AuthService.authenticate, AuthService.isAdmin, requestHandler(null, async (req, res) => {
    const result = await SubscriptionService.checkSubscriptionStatus(req.params.id);
    res.status(result.status ? 200 : 400).json(result);
}));

// Manually trigger subscription check for all subscriptions
router.post('/check-all', AuthService.authenticate, AuthService.isAdmin, requestHandler(null, async (req, res) => {
    const result = await SubscriptionService.checkAllSubscriptions();
    res.status(result.status ? 200 : 400).json(result);
}));

// Add this route to your existing subscription routes
router.get('/limits',
    AuthService.authenticate,
    requestHandler(null, async (req, res) => {
        const result = await SubscriptionService.checkSubscriptionLimits(req.user.id);
        res.status(result.status ? 200 : 400).json(result);
    })
);

// Add this route to your subscription routes
router.get('/analytics',
    AuthService.authenticate,
    AuthService.isAdmin,
    requestHandler(null, async (req, res) => {
        const result = await SubscriptionService.getSubscriptionAnalytics(req.query);
        res.status(result.status ? 200 : 400).json(result);
    })
);

module.exports = router; 