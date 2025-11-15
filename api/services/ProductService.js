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
            // Pagination parameters
            const page = parseInt(query.page) || 1;
            const pageSize = parseInt(query.pageSize) || 10;
            const offset = (page - 1) * pageSize;

            // Build where clause with shop access
            const whereClause = { UserId: { [Op.in]: accessibleShopIds } };

            // Add shopId filter if provided
            if (query.shopId) {
                const shopId = parseInt(query.shopId);
                if (accessibleShopIds.includes(shopId)) {
                    whereClause.UserId = shopId;
                }
            }

            // Add category filter if provided
            if (query.categoryId) {
                const categoryId = parseInt(query.categoryId);
                whereClause.CategoryId = categoryId;
            }

            // Add brand filter if provided
            if (query.brandId) {
                const brandId = parseInt(query.brandId);
                whereClause.BrandId = brandId;
            }

            // Add unit filter if provided
            if (query.unitId) {
                const unitId = parseInt(query.unitId);
                whereClause.UnitId = unitId;
            }

            // Add price range filter if provided
            if (query.minPrice || query.maxPrice) {
                whereClause.price = {};
                if (query.minPrice) {
                    const minPrice = parseFloat(query.minPrice);
                    whereClause.price[Op.gte] = minPrice;
                }
                if (query.maxPrice) {
                    const maxPrice = parseFloat(query.maxPrice);
                    whereClause.price[Op.lte] = maxPrice;
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

            // Add other filters if provided (exclude pagination, search, and filter params)
            const { searchKey, shopId, categoryId, brandId, unitId, minPrice, maxPrice, page: queryPage, pageSize: queryPageSize, ...otherFilters } = query;
            Object.keys(otherFilters).forEach(key => {
                if (otherFilters[key] !== undefined && otherFilters[key] !== null && otherFilters[key] !== '') {
                    whereClause[key] = otherFilters[key];
                }
            });

            // Get total count for pagination
            const totalCount = await Product.count({ where: whereClause });
            const totalPages = Math.ceil(totalCount / pageSize);

            // Get paginated products with related data
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
                ],
                limit: pageSize,
                offset: offset
            });

            return {
                status: true,
                message: "Products retrieved successfully",
                data: {
                    products,
                    pagination: {
                        page,
                        pageSize,
                        totalPages,
                        totalItems: totalCount,
                        hasNextPage: page < totalPages,
                        hasPreviousPage: page > 1
                    }
                }
            };
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