const { Product, ProductVariant, StockHistory } = require('../entity');
const sequelize = require('../db');

const StockService = {
    async adjustStock(adjustmentData, userId) {
        const transaction = await sequelize.transaction();
        try {
            const { productId, variantId, quantity, type, note } = adjustmentData;

            // Check if adjusting variant or product stock
            if (variantId) {
                const variant = await ProductVariant.findOne({
                    where: {
                        id: variantId,
                        ProductId: productId
                    },
                    include: [{
                        model: Product,
                        where: { UserId: userId }
                    }]
                });

                if (!variant) {
                    throw new Error("Product variant not found or unauthorized");
                }

                const previousStock = variant.quantity;
                const newStock = type === 'adjustment' ?
                    quantity :
                    type === 'return' ?
                        previousStock + quantity :
                        previousStock - quantity;

                // Update variant stock
                await variant.update({ quantity: newStock }, { transaction });

                // Create stock history
                await StockHistory.create({
                    type,
                    quantity,
                    previousStock,
                    newStock,
                    note,
                    ProductId: productId,
                    ProductVariantId: variantId,
                    UserId: userId
                }, { transaction });

            } else {
                const product = await Product.findOne({
                    where: {
                        id: productId,
                        UserId: userId
                    }
                });

                if (!product) {
                    throw new Error("Product not found or unauthorized");
                }

                const previousStock = product.quantity;
                const newStock = type === 'adjustment' ?
                    quantity :
                    type === 'return' ?
                        previousStock + quantity :
                        previousStock - quantity;

                // Update product stock
                await product.update({ quantity: newStock }, { transaction });

                // Create stock history
                await StockHistory.create({
                    type,
                    quantity,
                    previousStock,
                    newStock,
                    note,
                    ProductId: productId,
                    UserId: userId
                }, { transaction });
            }

            await transaction.commit();
            return {
                status: true,
                message: "Stock adjusted successfully"
            };

        } catch (error) {
            await transaction.rollback();
            return {
                status: false,
                message: "Failed to adjust stock",
                error: error.message
            };
        }
    },

    async getStockHistory(query, userId) {
        try {
            const whereClause = {
                UserId: userId,
                ...(query.productId && { ProductId: query.productId }),
                ...(query.variantId && { ProductVariantId: query.variantId }),
                ...(query.type && { type: query.type })
            };

            // Date range filter
            if (query.startDate && query.endDate) {
                whereClause.createdAt = {
                    [Op.between]: [new Date(query.startDate), new Date(query.endDate)]
                };
            }

            const history = await StockHistory.findAll({
                where: whereClause,
                include: [
                    {
                        model: Product,
                        attributes: ['name', 'sku']
                    },
                    {
                        model: ProductVariant,
                        attributes: ['sku']
                    }
                ],
                order: [['createdAt', 'DESC']]
            });

            return {
                status: true,
                message: "Stock history retrieved successfully",
                data: history
            };

        } catch (error) {
            return {
                status: false,
                message: "Failed to retrieve stock history",
                error: error.message
            };
        }
    },

    async getCurrentStock(productId, variantId, userId) {
        try {
            if (variantId) {
                const variant = await ProductVariant.findOne({
                    where: {
                        id: variantId,
                        ProductId: productId
                    },
                    include: [{
                        model: Product,
                        where: { UserId: userId }
                    }]
                });

                return {
                    status: true,
                    data: {
                        quantity: variant?.quantity || 0
                    }
                };
            } else {
                const product = await Product.findOne({
                    where: {
                        id: productId,
                        UserId: userId
                    }
                });

                return {
                    status: true,
                    data: {
                        quantity: product?.quantity || 0
                    }
                };
            }
        } catch (error) {
            return {
                status: false,
                message: "Failed to get current stock",
                error: error.message
            };
        }
    }
};

module.exports = StockService; 