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

            const variant = await ProductVariant.create(variantData);
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

            const filteredUpdateData = Object.keys(updateData).reduce((acc, key) => {
                if (updateData[key] !== undefined && updateData[key] !== null && updateData[key] !== '') {
                    acc[key] = updateData[key];
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