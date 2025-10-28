const { Op } = require('sequelize');

/**
 * Helper function to update service methods to use accessibleShopIds instead of userId
 * This function can be used to update service methods that filter by UserId
 */
function updateServiceMethodForShopAccess(serviceMethod, accessibleShopIds) {
    // Replace userId with accessibleShopIds in where clauses
    if (typeof serviceMethod === 'function') {
        return function(...args) {
            // Replace the userId parameter with accessibleShopIds
            const newArgs = [...args];
            if (newArgs.length >= 2) {
                newArgs[1] = accessibleShopIds; // Replace userId with accessibleShopIds
            }
            return serviceMethod.apply(this, newArgs);
        };
    }
    return serviceMethod;
}

/**
 * Helper function to build where clause with shop access
 */
function buildShopAccessWhereClause(baseWhere = {}, accessibleShopIds) {
    return {
        ...baseWhere,
        UserId: { [Op.in]: accessibleShopIds }
    };
}

/**
 * Helper function to update existing where clause with shop access
 */
function addShopAccessToWhereClause(whereClause, accessibleShopIds) {
    return {
        ...whereClause,
        UserId: { [Op.in]: accessibleShopIds }
    };
}

module.exports = {
    updateServiceMethodForShopAccess,
    buildShopAccessWhereClause,
    addShopAccessToWhereClause
};
