const { getAccessibleShopIds } = require('../utils/shopAccess');

/**
 * Middleware to add accessible shop IDs to the request object
 * This middleware should be used after authentication middleware
 */
const addShopAccess = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: false,
                message: "Authentication required",
                data: null
            });
        }

        // Get accessible shop IDs for the authenticated user
        const accessibleShopIds = await getAccessibleShopIds(req.user.id);
        
        // Add to request object for use in route handlers
        req.accessibleShopIds = accessibleShopIds;
        
        next();
    } catch (error) {
        console.error('Error in addShopAccess middleware:', error);
        return res.status(500).json({
            status: false,
            message: "Error determining shop access",
            data: null,
            error: error.message
        });
    }
};

/**
 * Middleware to validate that a user can access a specific shop's data
 * Expects shopId in req.params.shopId or req.query.shopId
 */
const validateShopAccess = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: false,
                message: "Authentication required",
                data: null
            });
        }

        // Get shop ID from params or query
        const shopId = req.params.shopId || req.query.shopId;
        
        if (!shopId) {
            // If no specific shop ID is provided, use the user's accessible shops
            const accessibleShopIds = await getAccessibleShopIds(req.user.id);
            req.accessibleShopIds = accessibleShopIds;
            return next();
        }

        // Check if user can access the specified shop
        const accessibleShopIds = await getAccessibleShopIds(req.user.id);
        
        if (!accessibleShopIds.includes(parseInt(shopId))) {
            return res.status(403).json({
                status: false,
                message: "Access denied: You don't have permission to access this shop's data",
                data: null
            });
        }

        req.accessibleShopIds = accessibleShopIds;
        next();
    } catch (error) {
        console.error('Error in validateShopAccess middleware:', error);
        return res.status(500).json({
            status: false,
            message: "Error validating shop access",
            data: null,
            error: error.message
        });
    }
};

/**
 * Helper function to build where clause for shop access
 * This can be used in service methods to filter data by accessible shops
 */
const buildShopAccessWhereClause = (accessibleShopIds) => {
    return {
        userId: {
            [require('sequelize').Op.in]: accessibleShopIds
        }
    };
};

/**
 * Helper function to add shop access filter to existing where clause
 */
const addShopAccessFilter = (whereClause, accessibleShopIds) => {
    return {
        ...whereClause,
        userId: {
            [require('sequelize').Op.in]: accessibleShopIds
        }
    };
};

module.exports = {
    addShopAccess,
    validateShopAccess,
    buildShopAccessWhereClause,
    addShopAccessFilter
};
