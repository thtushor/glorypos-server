const { ProductVariant, Product, Color, Size } = require('../entity');
const { Op } = require('sequelize');

/**
 * Generate a unique SKU for product variant
 * @param {string} prefix - Prefix for the SKU (e.g., 'VAR')
 * @param {number} length - Length of random part (default: 6)
 * @returns {Promise<string>} - Unique generated SKU
 */
async function generateUniqueVariantSku(prefix = 'VAR', length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let sku;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 50;

    while (!isUnique && attempts < maxAttempts) {
        // Generate random alphanumeric string
        const randomPart = Array.from({ length }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('');

        sku = `${prefix}-${randomPart}`;

        // Check if SKU already exists
        const existing = await ProductVariant.findOne({
            where: { sku: sku },
            attributes: ['id']
        });

        if (!existing) {
            isUnique = true;
        }
        attempts++;
    }

    if (!isUnique) {
        // Fallback: use timestamp if all attempts failed
        sku = `${prefix}-${Date.now().toString().slice(-8)}`;
    }

    return sku;
}

const ProductVariantService = {
    async create(variantData, userId) {
        try {
            // Check if the product belongs to the user
            const product = await Product.findOne({
                where: {
                    id: variantData.ProductId,
                    UserId: userId
                }
            });

            if (!product) {
                return {
                    status: false,
                    message: "Product not found or unauthorized",
                    data: null
                };
            }

            // Check if variant with same product, color and size exists
            const existingVariant = await ProductVariant.findOne({
                where: {
                    ProductId: variantData.ProductId,
                    ColorId: variantData.ColorId,
                    SizeId: variantData.SizeId
                },
                include: [{
                    model: Product,
                    where: { UserId: userId }
                }]
            });

            if (existingVariant) {
                return {
                    status: false,
                    message: "Variant with this combination already exists",
                    data: null
                };
            }

            // Handle images array: set first image to imageUrl and store all in images column
            const processedData = { ...variantData };

            if (variantData.images && Array.isArray(variantData.images) && variantData.images.length > 0) {
                // Set first image as imageUrl if not already set
                if (!processedData.imageUrl) {
                    processedData.imageUrl = variantData.images[0];
                }
                // Store all images in images column
                processedData.images = variantData.images;
            } else if (variantData.imageUrl && !processedData.images) {
                // If only single imageUrl is provided, also store it in images array
                processedData.images = [variantData.imageUrl];
            }

            // Auto-generate SKU if not provided or empty
            if (!processedData.sku || (typeof processedData.sku === 'string' && processedData.sku.trim() === '')) {
                processedData.sku = await generateUniqueVariantSku('VAR', 6);
            }

            const variant = await ProductVariant.create(processedData);
            return {
                status: true,
                message: "Product variant created successfully",
                data: variant
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to create product variant",
                data: null,
                error
            };
        }
    },

    async getAll(query = {}) {
        try {
            const variants = await ProductVariant.findAll({
                where: query,
                include: [
                    {
                        model: Product,
                        required: true
                    },
                    {
                        model: Color,
                    },
                    {
                        model: Size,
                    }
                ]
            });
            return {
                status: true,
                message: "Product variants retrieved successfully",
                data: variants
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to retrieve product variants",
                data: null,
                error
            };
        }
    },

    async getById(id) {
        try {
            const variant = await ProductVariant.findByPk(id, {
                include: [
                    { model: Product },
                    { model: Color },
                    { model: Size }
                ]
            });
            if (!variant) {
                return {
                    status: false,
                    message: "Product variant not found",
                    data: null
                };
            }
            return {
                status: true,
                message: "Product variant retrieved successfully",
                data: variant
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to retrieve product variant",
                data: null,
                error
            };
        }
    },

    async update(id, updateData) {
        try {
            const variant = await ProductVariant.findByPk(id);
            if (!variant) {
                return {
                    status: false,
                    message: "Product variant not found",
                    data: null
                };
            }



            // Check if update would create duplicate
            if (updateData.ProductId || updateData.ColorId || updateData.SizeId) {
                const existingVariant = await ProductVariant.findOne({
                    where: {
                        ProductId: updateData?.ProductId || variant?.dataValues?.ProductId,
                        ColorId: updateData?.ColorId || variant?.dataValues?.ColorId,
                        SizeId: updateData?.SizeId || variant?.dataValues?.SizeId,
                    }
                });

                if (existingVariant && existingVariant?.dataValues?.id !== variant?.dataValues?.id) {
                    return {
                        status: false,
                        message: "Variant with this combination already exists",
                        data: null
                    };
                }
            }

            // Handle images array: set first image to imageUrl and store all in images column
            const processedData = { ...updateData };

            if (updateData.images && Array.isArray(updateData.images) && updateData.images.length > 0) {
                // Set first image as imageUrl if not explicitly provided
                if (!processedData.imageUrl) {
                    processedData.imageUrl = updateData.images[0];
                }
                // Store all images in images column
                processedData.images = updateData.images;
            } else if (updateData.imageUrl && !processedData.images) {
                // If only single imageUrl is provided and images not updated, maintain existing images or set new one
                if (!variant.images || variant.images.length === 0) {
                    processedData.images = [updateData.imageUrl];
                } else {
                    // Update first image in array if imageUrl changed
                    const currentImages = Array.isArray(variant.images) ? [...variant.images] : [];
                    if (currentImages[0] !== updateData.imageUrl) {
                        currentImages[0] = updateData.imageUrl;
                        processedData.images = currentImages;
                    }
                }
            }

            // Auto-generate SKU if explicitly provided but empty, or if variant doesn't have SKU
            if (updateData.hasOwnProperty('sku')) {
                // Field is in request body
                if (!updateData.sku || (typeof updateData.sku === 'string' && updateData.sku.trim() === '')) {
                    // Generate if empty or null
                    processedData.sku = await generateUniqueVariantSku('VAR', 6);
                }
            } else if (!variant.sku) {
                // Field not in body, but variant doesn't have SKU - generate one
                processedData.sku = await generateUniqueVariantSku('VAR', 6);
            } else {
                // Field not in body and variant has SKU - keep existing (remove from update)
                delete processedData.sku;
            }

            const filteredUpdateData = Object.keys(processedData).reduce((acc, key) => {
                if (processedData[key] !== undefined && processedData[key] !== null && processedData[key] !== '') {
                    acc[key] = processedData[key];
                }
                return acc;
            }, {});

            await variant.update(filteredUpdateData);
            return {
                status: true,
                message: "Product variant updated successfully",
                data: variant
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to update product variant",
                data: null,
                error
            };
        }
    },

    async updateStock(id, quantity) {
        try {
            const variant = await ProductVariant.findByPk(id);
            if (!variant) {
                return {
                    status: false,
                    message: "Product variant not found",
                    data: null
                };
            }

            await variant.update({ quantity });
            return {
                status: true,
                message: "Stock updated successfully",
                data: variant
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to update stock",
                data: null,
                error
            };
        }
    },

    async delete(id) {
        try {
            const variant = await ProductVariant.findByPk(id);
            if (!variant) {
                return {
                    status: false,
                    message: "Product variant not found",
                    data: null
                };
            }
            await variant.destroy();
            return {
                status: true,
                message: "Product variant deleted successfully",
                data: null
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to delete product variant",
                data: null,
                error
            };
        }
    }
};

module.exports = ProductVariantService; 