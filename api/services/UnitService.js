const { Unit } = require('../entity');
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
            const whereClause = Object.keys(query).reduce((acc, key) => {
                if (query[key] !== undefined && query[key] !== null && query[key] !== '') {
                    acc[key] = query[key];
                }
                return acc;
            }, { UserId: { [Op.in]: accessibleShopIds } });

            const units = await Unit.findAll({ where: whereClause });
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
                }
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