const { Unit, User } = require('../entity');
const { Op } = require('sequelize');

const UnitService = {
    async create(unitData, userId) {
        try {
            // Check if unit name or shortName already exists for this user
            const existingUnit = await Unit.findOne({
                where: {
                    [Op.or]: [
                        {
                            name: unitData.name,
                            UserId: userId
                        },
                        {
                            shortName: unitData.shortName,
                            UserId: userId
                        }
                    ]
                }
            });

            if (existingUnit) {
                return {
                    status: false,
                    message: existingUnit.name === unitData.name
                        ? "Unit name already exists for this user"
                        : "Unit short name already exists for this user",
                    data: null
                };
            }

            const unit = await Unit.create({
                ...unitData,
                UserId: userId
            });
            return { status: true, message: "Unit created successfully", data: unit };
        } catch (error) {
            return { status: false, message: "Failed to create unit", data: null, error };
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
                    { shortName: { [Op.like]: `%${query.searchKey}%` } }
                ];
            }

            // Add other filters if provided
            const { searchKey, shopId, ...otherFilters } = query;
            Object.keys(otherFilters).forEach(key => {
                if (otherFilters[key] !== undefined && otherFilters[key] !== null && otherFilters[key] !== '') {
                    whereClause[key] = otherFilters[key];
                }
            });

            const units = await Unit.findAll({
                where: whereClause,
                include: [
                    {
                        model: User
                    }
                ]

            });
            return { status: true, message: "Units retrieved successfully", data: units };
        } catch (error) {
            return { status: false, message: "Failed to retrieve units", data: null, error };
        }
    },

    async getById(id, accessibleShopIds) {
        try {
            const unit = await Unit.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                },
                include: [
                    {
                        model: User
                    }
                ]
            });
            if (!unit) {
                return { status: false, message: "Unit not found", data: null };
            }
            return { status: true, message: "Unit retrieved successfully", data: unit };
        } catch (error) {
            return { status: false, message: "Failed to retrieve unit", data: null, error };
        }
    },

    async update(id, updateData, accessibleShopIds) {
        try {
            const unit = await Unit.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!unit) {
                return { status: false, message: "Unit not found", data: null };
            }

            // If trying to update name or shortName, check if they're unique
            if ((updateData.name && updateData.name !== unit.name) ||
                (updateData.shortName && updateData.shortName !== unit.shortName)) {
                const existingUnit = await Unit.findOne({
                    where: {
                        [Op.or]: [
                            {
                                name: updateData.name || unit.name,
                                UserId: userId,
                                id: { [Op.ne]: id }
                            },
                            {
                                shortName: updateData.shortName || unit.shortName,
                                UserId: userId,
                                id: { [Op.ne]: id }
                            }
                        ]
                    }
                });

                if (existingUnit) {
                    // Remove name and shortName from updates if they would create duplicates
                    const { name, shortName, ...allowedUpdates } = updateData;
                    await unit.update(allowedUpdates);
                    return {
                        status: true,
                        message: existingUnit.name === (updateData.name || unit.name)
                            ? "Unit updated successfully, but name was not changed as it already exists"
                            : "Unit updated successfully, but short name was not changed as it already exists",
                        data: unit
                    };
                }
            }

            // If no conflicts, update everything
            await unit.update(updateData);
            return { status: true, message: "Unit updated successfully", data: unit };
        } catch (error) {
            return { status: false, message: "Failed to update unit", data: null, error };
        }
    },

    async delete(id, accessibleShopIds) {
        try {
            const unit = await Unit.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!unit) {
                return { status: false, message: "Unit not found", data: null };
            }
            await unit.destroy();
            return { status: true, message: "Unit deleted successfully", data: null };
        } catch (error) {
            return { status: false, message: "Failed to delete unit", data: null, error };
        }
    }
};

module.exports = UnitService; 