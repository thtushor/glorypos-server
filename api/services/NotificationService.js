const { Product, ProductVariant, Color, Size } = require('../entity');
const { Op, Sequelize } = require('sequelize');
const sequelize = require('sequelize');

const NotificationService = {
    async getStockAlerts(userId) {
        try {
            // Get products with low or out of stock (only those without variants)
            const products = await Product.findAll({
                where: {
                    UserId: userId,
                    [Op.or]: [
                        {
                            stock: { [Op.lte]: Sequelize.col('Product.alertQuantity') }
                        },
                        {
                            stock: 0
                        }
                    ]
                },
                include: [{
                    model: ProductVariant,
                    attributes: [],  // We only need this for counting
                    required: false
                }],
                attributes: [
                    'id',
                    'name',
                    'sku',
                    'stock',
                    'alertQuantity',
                    [Sequelize.fn('COUNT', Sequelize.col('ProductVariants.id')), 'variantCount']
                ],
                group: [
                    'Product.id'
                ],
                having: Sequelize.literal('COUNT(ProductVariants.id) = 0')
            });

            // Get products with variants that have low or out of stock
            const productsWithVariants = await Product.findAll({
                where: {
                    UserId: userId
                },
                attributes: ['id', 'name'],
                include: [{
                    model: ProductVariant,
                    separate: true, // This will perform a separate query for variants
                    where: {
                        [Op.or]: [
                            {
                                quantity: { [Op.lte]: Sequelize.col('ProductVariant.alertQuantity') }
                            },
                            {
                                quantity: 0
                            }
                        ]
                    },
                    include: [
                        {
                            model: Color,
                            attributes: ['name'],
                            required: false
                        },
                        {
                            model: Size,
                            attributes: ['name'],
                            required: false
                        }
                    ],
                    attributes: [
                        'id',
                        'sku',
                        'quantity',
                        'alertQuantity'
                    ]
                }]
            });

            // Format notifications
            const notifications = [
                // Product notifications (for products without variants)
                ...products.map(product => ({
                    type: 'product',
                    id: product.id,
                    name: product.name,
                    sku: product.sku,
                    currentStock: product.stock,
                    alertQuantity: product.alertQuantity,
                    status: product.stock === 0 ? 'out_of_stock' : product.stock <= product.alertQuantity ? 'low_stock' : 'available',
                    message: product.stock === 0
                        ? `${product.name} is out of stock!`
                        : `${product.name} is running low on stock (${product.stock} remaining)`
                })),

                // Variant notifications
                ...productsWithVariants.flatMap(product =>
                    (product.ProductVariants || []).map(variant => ({
                        type: 'variant',
                        productId: product.id,
                        variantId: variant.id,
                        name: `${product.name} (${variant.Color?.name || ''} - ${variant.Size?.name || ''})`,
                        sku: variant.sku,
                        currentStock: variant.quantity,
                        alertQuantity: variant.alertQuantity,
                        status: variant.quantity === 0 ? 'out_of_stock' : variant.quantity <= variant.alertQuantity ? 'low_stock' : 'available',
                        message: variant.quantity === 0
                            ? `${product.name} (${variant.Color?.name || ''} - ${variant.Size?.name || ''}) is out of stock!`
                            : `${product.name} (${variant.Color?.name || ''} - ${variant.Size?.name || ''}) is running low on stock (${variant.quantity} remaining)`
                    }))
                )
            ].filter((item) => item?.status !== "available");

            // Sort notifications (out of stock first, then low stock)
            notifications.sort((a, b) => {
                if (a.status === 'out_of_stock' && b.status !== 'out_of_stock') return -1;
                if (a.status !== 'out_of_stock' && b.status === 'out_of_stock') return 1;
                return a.currentStock - b.currentStock;
            });

            // Add summary
            const summary = {
                totalAlerts: notifications.length,
                outOfStock: notifications.filter(n => n.status === 'out_of_stock').length,
                lowStock: notifications.filter(n => n.status === 'low_stock').length
            };

            return {
                status: true,
                message: "Stock alerts retrieved successfully",
                data: {
                    summary,
                    notifications
                }
            };

        } catch (error) {
            console.error(error);
            return {
                status: false,
                message: "Failed to retrieve stock alerts",
                error: error.message
            };
        }
    },

    async getUnreadNotificationCount(userId) {
        try {
            const { data } = await this.getStockAlerts(userId);
            return {
                status: true,
                data: {
                    count: data.summary.totalAlerts
                }
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to get notification count",
                error: error.message
            };
        }
    }
};

module.exports = NotificationService; 