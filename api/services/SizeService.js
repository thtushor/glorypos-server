const { Size, User } = require('../entity');
const { Op } = require('sequelize');

const SizeService = {
    async create(sizeData, userId) {
        try {
            // Check if size name already exists for this user
            const existingSize = await Size.findOne({
                where: {
                    name: sizeData.name,
                    UserId: userId
                }
            });

            if (existingSize) {
                return {
                    status: false,
                    message: "Size name already exists for this user",
                    data: null
                };
            }

            const size = await Size.create({
                ...sizeData,
                UserId: userId
            });
            return { status: true, message: "Size created successfully", data: size };
        } catch (error) {
            return { status: false, message: "Failed to create size", data: null, error };
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
                    { description: { [Op.like]: `%${query.searchKey}%` } }
                ];
            }

            // Add other filters if provided (excluding searchKey and shopId)
            const { searchKey, shopId, ...otherFilters } = query;
            Object.keys(otherFilters).forEach(key => {
                if (otherFilters[key] !== undefined && otherFilters[key] !== null && otherFilters[key] !== '') {
                    whereClause[key] = otherFilters[key];
                }
            });

            const sizes = await Size.findAll({
                where: whereClause, include: [
                    {
                        model: User
                    }
                ]
            });
            return { status: true, message: "Sizes retrieved successfully", data: sizes };
        } catch (error) {
            return { status: false, message: "Failed to retrieve sizes", data: null, error };
        }
    },

    async getById(id, accessibleShopIds) {
        try {
            const size = await Size.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!size) {
                return { status: false, message: "Size not found", data: null };
            }
            return { status: true, message: "Size retrieved successfully", data: size };
        } catch (error) {
            return { status: false, message: "Failed to retrieve size", data: null, error };
        }
    },

    async update(id, updateData, accessibleShopIds) {
        try {
            const size = await Size.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!size) {
                return { status: false, message: "Size not found", data: null };
            }

            // If trying to update name, check if it's unique
            if (updateData.name && updateData.name !== size.name) {
                const existingSize = await Size.findOne({
                    where: {
                        name: updateData.name,
                        UserId: size.UserId,
                        id: { [Op.ne]: id }
                    }
                });

                if (existingSize) {
                    // Remove name from updates if it would create a duplicate
                    const { name, ...allowedUpdates } = updateData;
                    const filteredUpdateData = Object.keys(allowedUpdates).reduce((acc, key) => {
                        if (allowedUpdates[key] !== undefined && allowedUpdates[key] !== null && allowedUpdates[key] !== '') {
                            acc[key] = allowedUpdates[key];
                        }
                        return acc;
                    }, {});

                    await size.update(filteredUpdateData);
                    return {
                        status: true,
                        message: "Size updated successfully, but name was not changed as it already exists",
                        data: size
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

            await size.update(filteredUpdateData);
            return { status: true, message: "Size updated successfully", data: size };
        } catch (error) {
            return { status: false, message: "Failed to update size", data: null, error };
        }
    },

    async delete(id, accessibleShopIds) {
        try {
            const size = await Size.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!size) {
                return { status: false, message: "Size not found", data: null };
            }
            await size.destroy();
            return { status: true, message: "Size deleted successfully", data: null };
        } catch (error) {
            return { status: false, message: "Failed to delete size", data: null, error };
        }
    }
};

module.exports = SizeService; 