const express = require('express');
const { CouponService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');

const router = express.Router();

// Admin routes
router.post('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await CouponService.createCoupon(req.body);
    res.status(result.status ? 201 : 400).json(result);
}));

router.get('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await CouponService.getAllCoupons(req.query);
    res.status(result.status ? 200 : 400).json(result);
}));

router.put('/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await CouponService.updateCoupon(req.params.id, req.body);
    res.status(result.status ? 200 : 400).json(result);
}));

router.post('/delete/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await CouponService.deleteCoupon(req.params.id);
    res.status(result.status ? 200 : 400).json(result);
}));

// Public route for validating coupon
router.post('/validate', requestHandler(null, async (req, res) => {
    const result = await CouponService.validateCoupon(req.body.code, req.body.amount);
    res.status(result.status ? 200 : 400).json(result);
}));

module.exports = router; 