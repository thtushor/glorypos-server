const { Brand, User } = require('../entity');
const { Op } = require('sequelize');

const BrandService = {
    async create(brandData, userId) {
        try {
            // Check if brand name already exists for this user
            const existingBrand = await Brand.findOne({
                where: {
                    name: brandData.name,
                    UserId: userId
                }
            });

            if (existingBrand) {
                return {
                    status: false,
                    message: "Brand name already exists for this user",
                    data: null
                };
            }

            const brand = await Brand.create({
                ...brandData,
                UserId: userId
            });
            return { status: true, message: "Brand created successfully", data: brand };
        } catch (error) {
            return { status: false, message: "Failed to create brand", data: null, error };
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

            const brands = await Brand.findAll({
                where: whereClause,
                include: [
                    {
                        model: User
                    }
                ]
            });
            return { status: true, message: "Brands retrieved successfully", data: brands };
        } catch (error) {
            return { status: false, message: "Failed to retrieve brands", data: null, error };
        }
    },

    async getById(id, accessibleShopIds) {
        try {
            const brand = await Brand.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!brand) {
                return { status: false, message: "Brand not found", data: null };
            }
            return { status: true, message: "Brand retrieved successfully", data: brand };
        } catch (error) {
            return { status: false, message: "Failed to retrieve brand", data: null, error };
        }
    },

    async update(id, updateData, accessibleShopIds) {
        try {
            const brand = await Brand.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });

            if (!brand) {
                return { status: false, message: "Brand not found", data: null };
            }

            // If trying to update name, check if it's unique
            if (updateData.name && updateData.name !== brand.name) {
                const existingBrand = await Brand.findOne({
                    where: {
                        name: updateData.name,
                        UserId: userId,
                        id: { [Op.ne]: id }
                    }
                });

                if (existingBrand) {
                    // Remove name from updates if it would create a duplicate
                    const { name, ...allowedUpdates } = updateData;
                    await brand.update(allowedUpdates);
                    return {
                        status: true,
                        message: "Brand updated successfully, but name was not changed as it already exists",
                        data: brand
                    };
                }
            }

            // If no name conflict, update everything
            await brand.update(updateData);
            return { status: true, message: "Brand updated successfully", data: brand };
        } catch (error) {
            return { status: false, message: "Failed to update brand", data: null, error };
        }
    },

    async delete(id, accessibleShopIds) {
        try {
            const brand = await Brand.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!brand) {
                return { status: false, message: "Brand not found", data: null };
            }
            await brand.destroy();
            return { status: true, message: "Brand deleted successfully", data: null };
        } catch (error) {
            return { status: false, message: "Failed to delete brand", data: null, error };
        }
    }
};

module.exports = BrandService; 