const { Size } = require('../entity');
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
            const whereClause = Object.keys(query).reduce((acc, key) => {
                if (query[key] !== undefined && query[key] !== null && query[key] !== '') {
                    acc[key] = query[key];
                }
                return acc;
            }, { UserId: { [Op.in]: accessibleShopIds } });

            const sizes = await Size.findAll({ where: whereClause });
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
                        UserId: userId,
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