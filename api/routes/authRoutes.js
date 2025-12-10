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
    res.status(200).json(result);
}));

router.get('/profile', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const email = req.query.email;
    console.log({ request: req.cookies });
    // Cookies that have been signed
    //   console.log('Signed Cookies: ', req.signedCookies)
    const result = await AuthService.getProfile(email,);
    res.status(200).json(result);
}));

router.get('/single-user/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const result = await AuthService.getUserById(req.params.id);
    res.status(200).json(result);
}));

router.post('/profile', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const userId = req.query.userId; // Assuming user ID is available in req.user
    const result = await AuthService.updateProfile(userId, req.body);
    res.status(200).json(result);
}));

router.get('/users', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const UserId = req?.user?.id || null;

    const result = await AuthService.getAllUsers(req?.query, UserId);
    res.status(200).json(result);
}));

router.get('/sub-shops', AuthService.authenticate, addShopAccess, requestHandler(null, async (req, res) => {
    const userId = req?.query?.userId || req?.user?.id;

    if (!userId) {
        return res.status(400).json({ status: false, message: "userId is required", data: null });
    }

    const accessibleShopIds = req.accessibleShopIds || [];

    const result = await AuthService.getSubShops(req?.query, userId, accessibleShopIds);
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