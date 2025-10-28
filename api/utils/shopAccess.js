const { User } = require('../entity');

/**
 * Get all accessible shop IDs for a given user
 * This includes the user's own shop and all shops that share the same parent
 * @param {number} userId - The ID of the user/shop
 * @returns {Promise<number[]>} Array of accessible shop IDs
 */
async function getAccessibleShopIds(userId) {
    try {
        // Get the user
        const user = await User.findByPk(userId);
        
        if (!user) {
            throw new Error('User not found');
        }

        // Determine the parent ID
        // If user has a parent_id, use that; otherwise, the user is the parent
        const parentId = user.parent_id || user.id;

        // Get all shops that share the same parent (including the parent itself)
        const shops = await User.findAll({
            where: {
                [require('sequelize').Op.or]: [
                    { id: parentId }, // The parent shop
                    { parent_id: parentId } // All child shops
                ]
            },
            attributes: ['id']
        });

        // Return array of shop IDs
        return shops.map(shop => shop.id);
    } catch (error) {
        console.error('Error getting accessible shop IDs:', error);
        throw error;
    }
}

/**
 * Get accessible shop IDs with additional information
 * @param {number} userId - The ID of the user/shop
 * @returns {Promise<Object>} Object containing shop IDs and metadata
 */
async function getAccessibleShopInfo(userId) {
    try {
        const user = await User.findByPk(userId, {
            include: [
                {
                    model: User,
                    as: 'parent',
                    attributes: ['id', 'fullName', 'businessName']
                },
                {
                    model: User,
                    as: 'children',
                    attributes: ['id', 'fullName', 'businessName']
                }
            ]
        });

        if (!user) {
            throw new Error('User not found');
        }

        const parentId = user.parent_id || user.id;
        const accessibleShopIds = await getAccessibleShopIds(userId);

        return {
            userId: user.id,
            parentId: parentId,
            accessibleShopIds: accessibleShopIds,
            isParent: !user.parent_id,
            parent: user.parent,
            children: user.children
        };
    } catch (error) {
        console.error('Error getting accessible shop info:', error);
        throw error;
    }
}

/**
 * Check if a user can access data from another shop
 * @param {number} requestingUserId - The ID of the user making the request
 * @param {number} targetShopId - The ID of the shop whose data is being accessed
 * @returns {Promise<boolean>} True if access is allowed
 */
async function canAccessShop(requestingUserId, targetShopId) {
    try {
        const accessibleShopIds = await getAccessibleShopIds(requestingUserId);
        return accessibleShopIds.includes(targetShopId);
    } catch (error) {
        console.error('Error checking shop access:', error);
        return false;
    }
}

module.exports = {
    getAccessibleShopIds,
    getAccessibleShopInfo,
    canAccessShop
};
