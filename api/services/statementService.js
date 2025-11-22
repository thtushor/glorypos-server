const { Order, OrderItem, Product, ProductVariant, Color, Size, User, UserRole, StuffCommission } = require('../entity');
const { Op, Sequelize } = require('sequelize');

class StatementService {
    async getProductStatements(query = {}) {
        try {
            // Pagination setup
            const page = parseInt(query.page) || 1;
            const pageSize = parseInt(query.pageSize) || 10;
            const offset = (page - 1) * pageSize;

            // Base where clause for OrderItem
            const whereClause = {};

            // Filter by ProductId
            if (query.productId) {
                const productId = parseInt(query.productId);
                if (!Number.isNaN(productId)) {
                    whereClause.ProductId = productId;
                }
            }

            // Filter by ProductVariantId
            if (query.productVariantId) {
                const productVariantId = parseInt(query.productVariantId);
                if (!Number.isNaN(productVariantId)) {
                    whereClause.ProductVariantId = productVariantId;
                }
            }

            // Date range filter for OrderItem
            if (query.startDate && query.endDate) {
                const start = new Date(query.startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(query.endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.createdAt = {
                    [Op.between]: [start, end]
                };
            } else if (query.startDate) {
                const start = new Date(query.startDate);
                start.setHours(0, 0, 0, 0);
                whereClause.createdAt = {
                    [Op.gte]: start
                };
            } else if (query.endDate) {
                const end = new Date(query.endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.createdAt = {
                    [Op.lte]: end
                };
            }

            // Build includes with filters
            const includeProduct = {
                model: Product,
                include: [
                    {
                        model: Color,
                        required: false
                    },
                    {
                        model: Size,
                        required: false
                    },
                    {
                        model: User,
                        required: false
                    }
                ],
                required: false
            };

            // Filter by ProductUserId (UserId in Product)
            if (query.productUserId) {
                const productUserId = parseInt(query.productUserId);
                if (!Number.isNaN(productUserId)) {
                    includeProduct.where = {
                        UserId: productUserId
                    };
                    includeProduct.required = true;
                }
            }

            const includeProductVariant = {
                model: ProductVariant,
                include: [
                    {
                        model: Color,
                        required: false
                    },
                    {
                        model: Size,
                        required: false
                    }
                ],
                required: false
            };

            // Order filter where clause
            const orderWhereClause = {};

            // Filter by UserRoleId through Order -> StuffCommission -> UserRole
            const includeCommission = {
                model: StuffCommission,
                as: "commissions",
                include: [
                    {
                        model: UserRole,
                        as: "staff",
                        include: [
                            {
                                model: User,
                                as: "parent",
                                required: false
                            }
                        ],
                        required: false
                    }
                ],
                required: false
            };

            if (query.userRoleId) {
                const userRoleId = parseInt(query.userRoleId);
                if (!Number.isNaN(userRoleId)) {
                    includeCommission.include[0].where = {
                        id: userRoleId
                    };
                    includeCommission.include[0].required = true;
                    includeCommission.required = true;
                }
            }

            const includeOrder = {
                model: Order,
                include: [
                    {
                        model: User,
                        required: false
                    },
                    includeCommission
                ],
                required: false,
                where: orderWhereClause
            };

            // Date range filter for Order (if needed)
            if (query.orderStartDate && query.orderEndDate) {
                const start = new Date(query.orderStartDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(query.orderEndDate);
                end.setHours(23, 59, 59, 999);
                orderWhereClause.orderDate = {
                    [Op.between]: [start, end]
                };
            }

            // Get total count for pagination (using same includes as findAll)
            const countIncludes = [
                includeProduct,
                includeProductVariant,
                includeOrder
            ];

            const totalCount = await OrderItem.count({
                where: whereClause,
                include: countIncludes,
                distinct: true
            });

            const totalPages = Math.ceil(totalCount / pageSize);

            // Get paginated statements
            const statements = await OrderItem.findAll({
                where: whereClause,
                include: [
                    includeProduct,
                    includeProductVariant,
                    includeOrder
                ],
                order: [['createdAt', 'DESC']],
                limit: pageSize,
                offset: offset
            });

            // Calculate summary statistics from all filtered results (not paginated)
            // Include Order to respect order-level filters like UserRoleId
            const summaryIncludes = [
                includeProduct,
                includeProductVariant,
                includeOrder
            ];

            const allFilteredItems = await OrderItem.findAll({
                where: whereClause,
                include: summaryIncludes,
                attributes: ['quantity', 'unitPrice', 'subtotal', 'purchasePrice']
            });

            // Calculate summary metrics
            const summary = allFilteredItems.reduce((acc, item) => {
                const quantity = Number(item.quantity || 0);
                const subtotal = Number(item.subtotal || 0);
                const unitPrice = Number(item.unitPrice || 0);
                const purchasePrice = Number(item.purchasePrice || 0);

                // Total sold (quantity)
                acc.totalSold += quantity;

                // Total revenue (subtotal from order items)
                acc.totalRevenue += subtotal;

                // Total cost (purchase price * quantity)
                const itemCost = purchasePrice * quantity;
                acc.totalCost += itemCost;

                // Calculate profit/loss per item
                const itemRevenue = subtotal; // Using subtotal which is already calculated
                const itemProfit = itemRevenue - itemCost;

                if (itemProfit >= 0) {
                    acc.totalProfit += itemProfit;
                } else {
                    acc.totalLoss += Math.abs(itemProfit);
                }

                return acc;
            }, {
                totalSold: 0,
                totalRevenue: 0,
                totalCost: 0,
                totalProfit: 0,
                totalLoss: 0
            });

            // Calculate profit margin percentage
            summary.profitMargin = summary.totalRevenue > 0
                ? Number(((summary.totalProfit / summary.totalRevenue) * 100).toFixed(2))
                : 0;

            // Calculate net profit (profit - loss)
            summary.netProfit = Number((summary.totalProfit - summary.totalLoss).toFixed(2));

            // Round all values to 2 decimal places
            summary.totalSold = Number(summary.totalSold);
            summary.totalRevenue = Number(summary.totalRevenue.toFixed(2));
            summary.totalCost = Number(summary.totalCost.toFixed(2));
            summary.totalProfit = Number(summary.totalProfit.toFixed(2));
            summary.totalLoss = Number(summary.totalLoss.toFixed(2));

            return {
                status: true,
                message: "Product statements retrieved successfully",
                data: {
                    statements,
                    summary,
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
            return {
                status: false,
                message: "Error retrieving product statements",
                error: error.message
            };
        }
    }

    async getSpecificProductStatement(productId, query = {}) {
        try {
            // Pagination setup
            const page = parseInt(query.page) || 1;
            const pageSize = parseInt(query.pageSize) || 10;
            const offset = (page - 1) * pageSize;

            // Validate productId
            const parsedProductId = parseInt(productId);
            if (Number.isNaN(parsedProductId)) {
                return {
                    status: false,
                    message: "Invalid product ID",
                    error: "Product ID must be a valid number"
                };
            }

            // Base where clause
            const whereClause = {
                ProductId: parsedProductId
            };

            // Filter by ProductVariantId
            if (query.productVariantId) {
                const productVariantId = parseInt(query.productVariantId);
                if (!Number.isNaN(productVariantId)) {
                    whereClause.ProductVariantId = productVariantId;
                }
            }

            // Date range filter
            if (query.startDate && query.endDate) {
                const start = new Date(query.startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(query.endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.createdAt = {
                    [Op.between]: [start, end]
                };
            } else if (query.startDate) {
                const start = new Date(query.startDate);
                start.setHours(0, 0, 0, 0);
                whereClause.createdAt = {
                    [Op.gte]: start
                };
            } else if (query.endDate) {
                const end = new Date(query.endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.createdAt = {
                    [Op.lte]: end
                };
            }

            // Build includes with filters
            const includeProduct = {
                model: Product,
                include: [
                    {
                        model: Color,
                        required: false
                    },
                    {
                        model: Size,
                        required: false
                    },
                    {
                        model: User,
                        required: false
                    }
                ],
                required: true
            };

            // Filter by ProductUserId (UserId in Product)
            if (query.productUserId) {
                const productUserId = parseInt(query.productUserId);
                if (!Number.isNaN(productUserId)) {
                    if (!includeProduct.where) {
                        includeProduct.where = {};
                    }
                    includeProduct.where.UserId = productUserId;
                    includeProduct.required = true;
                }
            }

            const includeProductVariant = {
                model: ProductVariant,
                include: [
                    {
                        model: Color,
                        required: false
                    },
                    {
                        model: Size,
                        required: false
                    }
                ],
                required: false
            };

            // Order filter
            const orderWhereClause = {};
            const includeCommission = {
                model: StuffCommission,
                as: "commissions",
                include: [
                    {
                        model: UserRole,
                        as: "staff",
                        include: [
                            {
                                model: User,
                                as: "parent",
                                required: false
                            }
                        ],
                        required: false
                    }
                ],
                required: false
            };

            // Filter by UserRoleId
            if (query.userRoleId) {
                const userRoleId = parseInt(query.userRoleId);
                if (!Number.isNaN(userRoleId)) {
                    includeCommission.include[0].where = {
                        id: userRoleId
                    };
                    includeCommission.include[0].required = true;
                    includeCommission.required = true;
                }
            }

            const includeOrder = {
                model: Order,
                include: [
                    {
                        model: User,
                        required: false
                    },
                    includeCommission
                ],
                required: false,
                where: orderWhereClause
            };

            // Date range filter for Order
            if (query.orderStartDate && query.orderEndDate) {
                const start = new Date(query.orderStartDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(query.orderEndDate);
                end.setHours(23, 59, 59, 999);
                orderWhereClause.orderDate = {
                    [Op.between]: [start, end]
                };
            }

            // Get total count for pagination (using same includes as findAll)
            const countIncludes = [
                includeOrder,
                includeProduct,
                includeProductVariant
            ];

            const totalCount = await OrderItem.count({
                where: whereClause,
                include: countIncludes,
                distinct: true
            });

            const totalPages = Math.ceil(totalCount / pageSize);

            // Get paginated statements
            const statements = await OrderItem.findAll({
                where: whereClause,
                include: [
                    includeOrder,
                    includeProduct,
                    includeProductVariant
                ],
                order: [['createdAt', 'DESC']],
                limit: pageSize,
                offset: offset
            });

            // Calculate summary statistics from all filtered results (not paginated)
            // Include Order to respect order-level filters like UserRoleId
            const summaryIncludes = [
                includeProduct,
                includeProductVariant,
                includeOrder
            ];

            const allFilteredItems = await OrderItem.findAll({
                where: whereClause,
                include: summaryIncludes,
                attributes: ['quantity', 'unitPrice', 'subtotal', 'purchasePrice']
            });

            // Calculate summary metrics
            const summary = allFilteredItems.reduce((acc, item) => {
                const quantity = Number(item.quantity || 0);
                const subtotal = Number(item.subtotal || 0);
                const unitPrice = Number(item.unitPrice || 0);
                const purchasePrice = Number(item.purchasePrice || 0);

                // Total sold (quantity)
                acc.totalSold += quantity;

                // Total revenue (subtotal from order items)
                acc.totalRevenue += subtotal;

                // Total cost (purchase price * quantity)
                const itemCost = purchasePrice * quantity;
                acc.totalCost += itemCost;

                // Calculate profit/loss per item
                const itemRevenue = subtotal; // Using subtotal which is already calculated
                const itemProfit = itemRevenue - itemCost;

                if (itemProfit >= 0) {
                    acc.totalProfit += itemProfit;
                } else {
                    acc.totalLoss += Math.abs(itemProfit);
                }

                return acc;
            }, {
                totalSold: 0,
                totalRevenue: 0,
                totalCost: 0,
                totalProfit: 0,
                totalLoss: 0
            });

            // Calculate profit margin percentage
            summary.profitMargin = summary.totalRevenue > 0
                ? Number(((summary.totalProfit / summary.totalRevenue) * 100).toFixed(2))
                : 0;

            // Calculate net profit (profit - loss)
            summary.netProfit = Number((summary.totalProfit - summary.totalLoss).toFixed(2));

            // Round all values to 2 decimal places
            summary.totalSold = Number(summary.totalSold);
            summary.totalRevenue = Number(summary.totalRevenue.toFixed(2));
            summary.totalCost = Number(summary.totalCost.toFixed(2));
            summary.totalProfit = Number(summary.totalProfit.toFixed(2));
            summary.totalLoss = Number(summary.totalLoss.toFixed(2));

            return {
                status: true,
                message: "Product statement retrieved successfully",
                data: {
                    statements,
                    summary,
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
            return {
                status: false,
                message: "Error retrieving specific product statement",
                error: error.message
            };
        }
    }

    async getDailySummary(query) {
        try {
            const whereClause = {};

            // Date range filter
            if (query.startDate && query.endDate) {
                whereClause.createdAt = {
                    [Op.between]: [
                        new Date(new Date(query.startDate).setHours(0, 0, 0)),
                        new Date(new Date(query.endDate).setHours(23, 59, 59))
                    ]
                };
            }

            const dailyStats = await OrderItem.findAll({
                attributes: [
                    [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'date'],
                    [Sequelize.fn('SUM', Sequelize.col('totalPrice')), 'totalSales'],
                    [Sequelize.fn('SUM', Sequelize.col('profit')), 'totalProfit'],
                    [Sequelize.fn('SUM', Sequelize.col('loss')), 'totalLoss'],
                ],
                where: whereClause,
                group: [Sequelize.fn('DATE', Sequelize.col('createdAt'))],
                order: [[Sequelize.fn('DATE', Sequelize.col('createdAt')), 'DESC']]
            });

            return {
                status: true,
                message: "Daily summary retrieved successfully",
                data: dailyStats
            };
        } catch (error) {
            return {
                status: false,
                message: "Error retrieving daily summary",
                error: error.message
            };
        }
    }
}

module.exports = new StatementService();
