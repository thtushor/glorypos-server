const { Product, Category, Brand, Unit, ProductVariant, Color, Size, User } = require('../entity');
const { Op } = require('sequelize');

/**
 * Generate a unique short code
 * @param {string} prefix - Prefix for the code (e.g., 'SKU', 'PRD')
 * @param {string} field - Field name to check uniqueness ('sku' or 'code')
 * @param {number} length - Length of random part (default: 6)
 * @returns {Promise<string>} - Unique generated code
 */
async function generateUniqueCode(prefix = 'PRD', field = 'code', length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 50;

    while (!isUnique && attempts < maxAttempts) {
        // Generate random alphanumeric string
        const randomPart = Array.from({ length }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('');

        code = `${prefix}-${randomPart}`;

        // Check if code already exists
        const existing = await Product.findOne({
            where: { [field]: code },
            attributes: ['id']
        });

        if (!existing) {
            isUnique = true;
        }
        attempts++;
    }

    if (!isUnique) {
        // Fallback: use timestamp if all attempts failed
        code = `${prefix}-${Date.now().toString().slice(-8)}`;
    }

    return code;
}

const ProductService = {
    async create(productData, userId) {
        // Handle images array: set first image to productImage and store all in images column
        const processedData = { ...productData };

        if (productData.images && Array.isArray(productData.images) && productData.images.length > 0) {
            // Set first image as productImage if not already set

            processedData.productImage = productData.images[0];

            // Store all images in images column
            processedData.images = productData.images;
        } else if (productData.productImage && !processedData.images) {
            // If only single productImage is provided, also store it in images array
            processedData.images = [productData.productImage];
        }

        // Auto-generate SKU if not provided
        if (!processedData.sku || processedData.sku.trim() === '') {
            processedData.sku = await generateUniqueCode('SKU', 'sku', 6);
        }

        // Auto-generate code if not provided
        if (!processedData.code || processedData.code.trim() === '') {
            processedData.code = await generateUniqueCode('PRD', 'code', 6);
        }

        // Convert 0 values to null for foreign key IDs
        if (processedData.CategoryId === 0) {
            processedData.CategoryId = null;
        }
        if (processedData.BrandId === 0) {
            processedData.BrandId = null;
        }
        if (processedData.UnitId === 0) {
            processedData.UnitId = null;
        }
        if (processedData.ColorId === 0) {
            processedData.ColorId = null;
        }
        if (processedData.SizeId === 0) {
            processedData.SizeId = null;
        }

        const product = await Product.create({
            ...processedData,
            UserId: processedData?.UserId || userId
        });
        return { status: true, message: "Product created successfully", data: product };
    },

    async getAll(query = {}, accessibleShopIds) {
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

        if (query.status) {
            whereClause.status = query.status;
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

        // ✅ SKU Filter - Handle separately
        let skuFilter = null;
        if (query?.sku) {
            skuFilter = query.sku;
            // Add product SKU to where clause
            whereClause.sku = query.sku;
        }


        // Add modelNo filter if provided
        if (query.modelNo) {
            whereClause.modelNo = { [Op.like]: `%${query.modelNo}%` };
        }

        // Add gender filter if provided
        if (query.gender) {
            whereClause.gender = query.gender;
        }

        // Add search functionality
        if (query.searchKey) {
            const searchConditions = [
                { name: { [Op.like]: `%${query.searchKey}%` } },
                { code: { [Op.like]: `%${query.searchKey}%` } },
                { sku: { [Op.like]: `%${query.searchKey}%` } },
                { description: { [Op.like]: `%${query.searchKey}%` } },
                { modelNo: { [Op.like]: `%${query.searchKey}%` } }
            ];

            whereClause[Op.or] = searchConditions;
        }

        // Add other filters if provided (exclude pagination, search, and filter params)
        const { searchKey, shopId, categoryId, brandId, unitId, minPrice, maxPrice, modelNo, gender, page: queryPage, pageSize: queryPageSize, ...otherFilters } = query;
        Object.keys(otherFilters).forEach(key => {
            if (otherFilters[key] !== undefined && otherFilters[key] !== null && otherFilters[key] !== '') {
                whereClause[key] = otherFilters[key];
            }
        });


        // ✅ If SKU filter exists, we need to find products with matching variants too
        let productIdsFromVariants = [];
        if (skuFilter) {
            const variantsWithSku = await ProductVariant.findAll({
                where: { sku: skuFilter },
                attributes: ['ProductId'],
                raw: true
            });
            productIdsFromVariants = variantsWithSku.map(v => v.ProductId);

            // Modify where clause to include products with matching variants
            if (productIdsFromVariants.length > 0) {
                // Remove the direct sku filter
                delete whereClause.sku;
                // Add OR condition for product sku or product id in variant matches
                whereClause[Op.or] = [
                    { sku: skuFilter },
                    { id: { [Op.in]: productIdsFromVariants } }
                ];
            }
        }


        // Get total count for pagination
        const totalCount = await Product.count({
            where: whereClause,
            include: query?.sku ? [
                {
                    model: ProductVariant,
                    attributes: [],
                    required: false // LEFT JOIN to include products without variants
                }
            ] : [],
            distinct: true // Count distinct products only
        });

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
                    require: false,
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
        const product = await Product.findOne({
            where: {
                id: id,
                UserId: { [Op.in]: accessibleShopIds }
            }
        });
        if (!product) {
            return { status: false, message: "Product not found", data: null };
        }

        // Handle images array: set first image to productImage and store all in images column
        const processedData = { ...updateData };

        if (updateData.images && Array.isArray(updateData.images) && updateData.images.length > 0) {
            // Set first image as productImage if not explicitly provided

            processedData.productImage = updateData.images[0];

            // Store all images in images column
            processedData.images = updateData.images;
        } else if (updateData.productImage && !processedData.images) {
            // If only single productImage is provided and images not updated, maintain existing images or set new one
            if (!product.images || product.images.length === 0) {
                processedData.images = [updateData.productImage];
            } else {
                // Update first image in array if productImage changed
                const currentImages = Array.isArray(product.images) ? [...product.images] : [];
                if (currentImages[0] !== updateData.productImage) {
                    currentImages[0] = updateData.productImage;
                    processedData.images = currentImages;
                }
            }
        }

        // Convert 0 values to null for foreign key IDs
        if (processedData.CategoryId === 0) {
            processedData.CategoryId = null;
        }
        if (processedData.BrandId === 0) {
            processedData.BrandId = null;
        }
        if (processedData.UnitId === 0) {
            processedData.UnitId = null;
        }
        if (processedData.ColorId === 0) {
            processedData.ColorId = null;
        }
        if (processedData.SizeId === 0) {
            processedData.SizeId = null;
        }

        // Auto-generate SKU if explicitly provided but empty, or if product doesn't have SKU
        if (updateData.hasOwnProperty('sku')) {
            // Field is in request body
            if (!updateData.sku || (typeof updateData.sku === 'string' && updateData.sku.trim() === '')) {
                // Generate if empty or null
                processedData.sku = await generateUniqueCode('SKU', 'sku', 6);
            }
        } else if (!product.sku) {
            // Field not in body, but product doesn't have SKU - generate one
            processedData.sku = await generateUniqueCode('SKU', 'sku', 6);
        } else {
            // Field not in body and product has SKU - keep existing (remove from update)
            delete processedData.sku;
        }

        // Auto-generate code if explicitly provided but empty, or if product doesn't have code
        if (updateData.hasOwnProperty('code')) {
            // Field is in request body
            if (!updateData.code || (typeof updateData.code === 'string' && updateData.code.trim() === '')) {
                // Generate if empty or null
                processedData.code = await generateUniqueCode('PRD', 'code', 6);
            }
        } else if (!product.code) {
            // Field not in body, but product doesn't have code - generate one
            processedData.code = await generateUniqueCode('PRD', 'code', 6);
        } else {
            // Field not in body and product has code - keep existing (remove from update)
            delete processedData.code;
        }

        await product.update(processedData);
        return { status: true, message: "Product updated successfully", data: product };
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
