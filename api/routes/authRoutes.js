const express = require('express');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');
const { addShopAccess } = require('../middleware/shopAccessMiddleware');

const router = express.Router();

router.post('/register', requestHandler(null, async (req, res) => {
    const result = await AuthService.register(req.body);
    res.status(200).json(result);
}));


router.post('/register-super-admin', requestHandler(null, async (req, res) => {
    const result = await AuthService.registerSuperAdmin(req.body);
    res.status(200).json(result);
}));

router.post('/login', requestHandler(null, async (req, res) => {
    const result = await AuthService.login(req.body.email, req.body.password);

    if (result.status && result.data?.token) {
        // Set httpOnly cookie for automatic authentication
        // secure: true in production (HTTPS), false in development
        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie("access_token", result.data.token, {
            httpOnly: true,        // 🔒 JS can't access (XSS protection)
            secure: isProduction,   // HTTPS only in production
            sameSite: "strict",    // CSRF protection
            maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
            path: '/',             // Available for all routes
        });
    }

    res.status(200).json(result);
}));

router.post('/logout', AuthService.authenticate, requestHandler(null, async (req, res) => {
    // Clear the access_token cookie
    res.clearCookie('access_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });

    res.status(200).json({
        status: true,
        message: "Logout successful",
        data: null
    });
}));

router.get('/profile', AuthService.authenticate, requestHandler(null, async (req, res) => {
    // Use authenticated user's email from req.user (set by authenticate middleware)
    const email = req.email;
    const result = await AuthService.getProfile(email);
    res.status(200).json(result);
}));

router.get('/single-user/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await AuthService.getUserById(req.params.id);
    res.status(200).json(result);
}));

router.post('/profile', AuthService.authenticate, requestHandler(null, async (req, res) => {
    // Use authenticated user's ID from req.user (set by authenticate middleware)
    const userId = req.user?.id;
    const result = await AuthService.updateProfile(userId, req.body);
    res.status(200).json(result);
}));

router.get('/users', AuthService.authenticate, requestHandler(null, async (req, res) => {
    // Use authenticated user's ID from req.user (set by authenticate middleware)
    const userId = req.user?.id;

    const result = await AuthService.getAllUsers(req.query, userId);
    res.status(200).json(result);
}));

router.get('/sub-shops', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    // Use authenticated user's ID from req.user (set by authenticate middleware)
    const userId = req.user?.id;

    if (!userId) {
        return res.status(400).json({ status: false, message: "Authentication required", data: null });
    }

    const accessibleShopIds = req.accessibleShopIds || [];

    const result = await AuthService.getSubShops(req.query, userId, accessibleShopIds);
    res.status(200).json(result);
}));


router.post('/verify-email', requestHandler(null, async (req, res) => {
    const result = await AuthService.verifyEmail(req?.body?.token, req.body.email);
    res.status(200).json(result);
}));
// Password reset routes
router.post('/request-reset', requestHandler(null, async (req, res) => {
    const result = await AuthService.requestPasswordReset(req.body.email);
    res.status(200).json(result);
}));

router.get('/verify-reset-token/:token', requestHandler(null, async (req, res) => {
    const result = await AuthService.verifyResetToken(req.params.token);
    res.status(200).json(result);
}));

router.post('/reset-password', requestHandler(null, async (req, res) => {
    const result = await AuthService.resetPassword(req.body.token, req.body.newPassword);
    res.status(200).json(result);
}));



module.exports = router;