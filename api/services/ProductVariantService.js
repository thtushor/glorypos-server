const { ProductVariant, Product, Color, Size } = require('../entity');

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

            console.log("updateData", { updateData });

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