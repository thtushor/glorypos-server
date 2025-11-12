const { Product, Category, Brand, Unit, ProductVariant, Color, Size, User } = require('../entity');
const { Op } = require('sequelize');

const ProductService = {
    async create(productData, userId) {
        try {
            const product = await Product.create({
                ...productData,
                UserId: userId
            });
            return { status: true, message: "Product created successfully", data: product };
        } catch (error) {
            return { status: false, message: "Failed to create product", data: null, error };
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
                    { sku: { [Op.like]: `%${query.searchKey}%` } },
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

            const products = await Product.findAll({
                where: whereClause,
                include: [
                    {
                        model: User
                    },
                    {
                        model: Category,
                    },
                    {
                        model: Brand,
                    },
                    {
                        model: Unit,
                    },
                    {
                        model: Color,
                    },
                    {
                        model: Size,
                    },
                    {
                        model: ProductVariant,
                        include: [
                            {
                                model: Color,
                            },
                            {
                                model: Size,
                            }
                        ]
                    }
                ]
            });
            return { status: true, message: "Products retrieved successfully", data: products };
        } catch (error) {
            return { status: false, message: "Failed to retrieve products", data: null, error };
        }
    },

    async getById(id, accessibleShopIds) {
        try {
            const product = await Product.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                },
                include: [
                    {
                        model: User
                    },
                    {
                        model: Category,
                        where: { UserId: { [Op.in]: accessibleShopIds } }
                    },
                    {
                        model: Brand,
                        where: { UserId: { [Op.in]: accessibleShopIds } }
                    },
                    {
                        model: Unit,
                        where: { UserId: { [Op.in]: accessibleShopIds } }
                    },
                    {
                        model: Color,
                    },
                    {
                        model: Size,
                    },
                    {
                        model: ProductVariant,
                        include: [
                            {
                                model: Color,
                                where: { UserId: { [Op.in]: accessibleShopIds } }
                            },
                            {
                                model: Size,
                                where: { UserId: { [Op.in]: accessibleShopIds } }
                            }
                        ]
                    }
                ]
            });
            if (!product) {
                return { status: false, message: "Product not found", data: null };
            }
            return { status: true, message: "Product retrieved successfully", data: product };
        } catch (error) {
            return { status: false, message: "Failed to retrieve product", data: null, error };
        }
    },

    async update(id, updateData, accessibleShopIds) {
        try {
            const product = await Product.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!product) {
                return { status: false, message: "Product not found", data: null };
            }
            await product.update(updateData);
            return { status: true, message: "Product updated successfully", data: product };
        } catch (error) {
            return { status: false, message: "Failed to update product", data: null, error };
        }
    },

    async delete(id, accessibleShopIds) {
        try {
            const product = await Product.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!product) {
                return { status: false, message: "Product not found", data: null };
            }
            await product.destroy();
            return { status: true, message: "Product deleted successfully", data: null };
        } catch (error) {
            return { status: false, message: "Failed to delete product", data: null, error };
        }
    }
};

module.exports = ProductService; 