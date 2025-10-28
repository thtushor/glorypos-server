const express = require('express');
const { UserRoleService } = require('../services');
const { AuthService } = require('../services');
const subscriptionLimits = require('../middleware/subscriptionLimits');
const requestHandler = require('../utils/requestHandler');
const { addShopAccess } = require('../middleware/shopAccessMiddleware');

const router = express.Router();

// Add child user
router.post('/child-user',
    AuthService.authenticate,
    subscriptionLimits.checkSubscriptionStatus,
    subscriptionLimits.checkUserLimit,
    requestHandler(null, async (req, res) => {
        const result = await UserRoleService.addChildUser(req.user.id, req.body);
        res.status(result.status ? 201 : 400).json(result);
    })
);

// Update child user role/permissions
router.post('/child-user/:id',
    AuthService.authenticate,
    addShopAccess,
    requestHandler(null, async (req, res) => {
        const result = await UserRoleService.updateUserRole(req.params.id, req.body, req.accessibleShopIds);
        res.status(result.status ? 200 : 400).json(result);
    })
);

// Get all child users
router.get('/child-users',
    AuthService.authenticate,
    addShopAccess,
    requestHandler(null, async (req, res) => {
        const result = await UserRoleService.getChildUsers(req.accessibleShopIds, req?.query);
        res.status(result.status ? 200 : 400).json(result);
    })
);

// Delete child user
router.post('/child-users/delete/:id',
    AuthService.authenticate,
    addShopAccess,
    requestHandler(null, async (req, res) => {
        const result = await UserRoleService.deleteChildUser(req.params.id, req.accessibleShopIds);
        res.status(result.status ? 200 : 400).json(result);
    })
);

module.exports = router; 