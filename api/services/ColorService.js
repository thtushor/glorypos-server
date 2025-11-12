const { Color } = require('../entity');
const { Op } = require('sequelize');

const ColorService = {
    async create(colorData, userId) {
        try {
            // Check if color name already exists for this user
            const existingColor = await Color.findOne({
                where: {
                    name: colorData.name,
                    UserId: userId
                }
            });

            if (existingColor) {
                return {
                    status: false,
                    message: "Color name already exists for this user",
                    data: null
                };
            }

            const color = await Color.create({
                ...colorData,
                UserId: userId
            });
            return { status: true, message: "Color created successfully", data: color };
        } catch (error) {
            return { status: false, message: "Failed to create color", data: null, error };
        }
    },

    async getAll(query = {}, accessibleShopIds) {
        try {
            // Build where clause with shop access
            const whereClause = { UserId: { [Op.in]: accessibleShopIds } };

            // Add shopId filter if provided
            if (query.shopId) {
                const shopId = parseInt(query.shopId);
                if (accessibleShopIds.includes(shopId)) {
                    whereClause.UserId = shopId;
                }
            }

            // Add search functionality
            if (query.searchKey) {
                whereClause[Op.or] = [
                    { name: { [Op.like]: `%${query.searchKey}%` } },
                    { code: { [Op.like]: `%${query.searchKey}%` } },
                    { description: { [Op.like]: `%${query.searchKey}%` } }
                ];
            }

            // Add other filters if provided
            const { searchKey, shopId, ...otherFilters } = query;
            Object.keys(otherFilters).forEach(key => {
                if (otherFilters[key] !== undefined && otherFilters[key] !== null && otherFilters[key] !== '') {
                    whereClause[key] = otherFilters[key];
                }
            });

            const colors = await Color.findAll({ where: whereClause });
            return { status: true, message: "Colors retrieved successfully", data: colors };
        } catch (error) {
            return { status: false, message: "Failed to retrieve colors", data: null, error };
        }
    },

    async getById(id, accessibleShopIds) {
        try {
            const color = await Color.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!color) {
                return { status: false, message: "Color not found", data: null };
            }
            return { status: true, message: "Color retrieved successfully", data: color };
        } catch (error) {
            return { status: false, message: "Failed to retrieve color", data: null, error };
        }
    },

    async update(id, updateData, accessibleShopIds) {
        try {
            const color = await Color.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!color) {
                return { status: false, message: "Color not found", data: null };
            }

            // If trying to update name, check if it's unique
            if (updateData.name && updateData.name !== color.name) {
                const existingColor = await Color.findOne({
                    where: {
                        name: updateData.name,
                        UserId: { [Op.in]: accessibleShopIds },
                        id: { [Op.ne]: id }
                    }
                });

                if (existingColor) {
                    // Remove name from updates if it would create a duplicate
                    const { name, ...allowedUpdates } = updateData;
                    const filteredUpdateData = Object.keys(allowedUpdates).reduce((acc, key) => {
                        if (allowedUpdates[key] !== undefined && allowedUpdates[key] !== null && allowedUpdates[key] !== '') {
                            acc[key] = allowedUpdates[key];
                        }
                        return acc;
                    }, {});

                    await color.update(filteredUpdateData);
                    return {
                        status: true,
                        message: "Color updated successfully, but name was not changed as it already exists",
                        data: color
                    };
                }
            }

            // If no name conflict, update everything
            const filteredUpdateData = Object.keys(updateData).reduce((acc, key) => {
                if (updateData[key] !== undefined && updateData[key] !== null && updateData[key] !== '') {
                    acc[key] = updateData[key];
                }
                return acc;
            }, {});

            await color.update(filteredUpdateData);
            return { status: true, message: "Color updated successfully", data: color };
        } catch (error) {
            return { status: false, message: "Failed to update color", data: null, error };
        }
    },

    async delete(id, accessibleShopIds) {
        try {
            const color = await Color.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!color) {
                return { status: false, message: "Color not found", data: null };
            }
            await color.destroy();
            return { status: true, message: "Color deleted successfully", data: null };
        } catch (error) {
            return { status: false, message: "Failed to delete color", data: null, error };
        }
    }
};

module.exports = ColorService; 