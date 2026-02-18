const { Category, User } = require('../entity');
const { Op } = require('sequelize');

/**
 * Generate a unique barcode for category
 * @param {number} userId - The shop ID
 * @param {string} prefix - Prefix for the barcode
 * @param {number} length - Length of random part
 * @returns {Promise<string>} - Unique generated barcode
 */
async function generateUniqueBarcode(userId, prefix = 'CAT', length = 6) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let barcode;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 50;

    while (!isUnique && attempts < maxAttempts) {
        const randomPart = Array.from({ length }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('');

        barcode = `${prefix}-${randomPart}`;

        const existing = await Category.findOne({
            where: {
                barcode,
                UserId: userId
            },
            attributes: ['id']
        });

        if (!existing) {
            isUnique = true;
        }
        attempts++;
    }

    if (!isUnique) {
        barcode = `${prefix}-${Date.now().toString().slice(-6)}`;
    }

    return barcode;
}

const CategoryService = {
    async create(categoryData, userId) {
        try {
            // Check if category name already exists for this user
            const existingCategory = await Category.findOne({
                where: {
                    name: categoryData.name,
                    UserId: userId
                }
            });

            if (existingCategory) {
                return {
                    status: false,
                    message: "Category name already exists for this user",
                    data: null
                };
            }

            // Auto-generate barcode if not provided or empty
            const processedData = { ...categoryData };
            if (!processedData.barcode || processedData.barcode.trim() === '') {
                processedData.barcode = await generateUniqueBarcode(userId);
            } else {
                // If provided, check if it's unique shopwise
                const barcodeExists = await Category.findOne({
                    where: {
                        barcode: processedData.barcode,
                        UserId: userId
                    }
                });
                if (barcodeExists) {
                    return {
                        status: false,
                        message: "Barcode already exists for this shop",
                        data: null
                    };
                }
            }

            const category = await Category.create({
                ...processedData,
                UserId: userId
            });
            return { status: true, message: "Category created successfully", data: category };
        } catch (error) {
            return { status: false, message: "Failed to create category", data: null, error };
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

            // Add other filters if provided
            const { searchKey, shopId, ...otherFilters } = query;
            Object.keys(otherFilters).forEach(key => {
                if (otherFilters[key] !== undefined && otherFilters[key] !== null && otherFilters[key] !== '') {
                    whereClause[key] = otherFilters[key];
                }
            });

            const categories = await Category.findAll({
                where: whereClause,
                include: [
                    {
                        model: User
                    }
                ]
            });
            return { status: true, message: "Categories retrieved successfully", data: categories };
        } catch (error) {
            console.log({ error })
            return { status: false, message: "Failed to retrieve categories", data: null, error };
        }
    },

    async getById(id, accessibleShopIds) {
        try {
            const category = await Category.findOne({
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
            if (!category) {
                return { status: false, message: "Category not found", data: null };
            }
            return { status: true, message: "Category retrieved successfully", data: category };
        } catch (error) {
            return { status: false, message: "Failed to retrieve category", data: null, error };
        }
    },

    async update(id, updateData, accessibleShopIds) {
        try {
            const category = await Category.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!category) {
                return { status: false, message: "Category not found", data: null };
            }

            // If trying to update name, check if it's unique
            if (updateData.name && updateData.name !== category.name) {
                const existingCategory = await Category.findOne({
                    where: {
                        name: updateData.name,
                        UserId: { [Op.in]: accessibleShopIds },
                        id: { [Op.ne]: id }
                    }
                });

                if (existingCategory) {
                    // Remove name from updates if it would create a duplicate
                    delete updateData.name;
                    // Note: original code had a complex reduction here, I'll simplify but keep the logic
                }
            }

            // Handle barcode update/generation
            if (updateData.hasOwnProperty('barcode')) {
                if (!updateData.barcode || (typeof updateData.barcode === 'string' && updateData.barcode.trim() === '')) {
                    updateData.barcode = await generateUniqueBarcode(category.UserId);
                } else if (updateData.barcode !== category.barcode) {
                    const barcodeExists = await Category.findOne({
                        where: {
                            barcode: updateData.barcode,
                            UserId: category.UserId,
                            id: { [Op.ne]: id }
                        }
                    });
                    if (barcodeExists) {
                        delete updateData.barcode;
                    }
                }
            } else if (!category.barcode) {
                updateData.barcode = await generateUniqueBarcode(category.UserId);
            }

            // Clean up updateData to remove undefined/null/empty strings (as per existing pattern)
            const filteredUpdateData = Object.keys(updateData).reduce((acc, key) => {
                if (updateData[key] !== undefined && updateData[key] !== null && updateData[key] !== '') {
                    acc[key] = updateData[key];
                }
                return acc;
            }, {});

            await category.update(filteredUpdateData);
            return { status: true, message: "Category updated successfully", data: category };
        } catch (error) {
            return { status: false, message: "Failed to update category", data: null, error };
        }
    },

    async delete(id, accessibleShopIds) {
        try {
            const category = await Category.findOne({
                where: {
                    id: id,
                    UserId: { [Op.in]: accessibleShopIds }
                }
            });
            if (!category) {
                return { status: false, message: "Category not found", data: null };
            }
            await category.destroy();
            return { status: true, message: "Category deleted successfully", data: null };
        } catch (error) {
            return { status: false, message: "Failed to delete category", data: null, error };
        }
    }
};

module.exports = CategoryService; 