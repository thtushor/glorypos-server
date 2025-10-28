const { Order, OrderItem, Product, ProductVariant, Color, Size } = require('../entity');
const { Op, Sequelize } = require('sequelize');

class StatementService {
    async getProductStatements(query) {
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

            const statements = await OrderItem.findAll({
                include: [
                    {
                        model: Product,
                        include: [{
                            model: Color
                        }, {
                            model: Size
                        }]
                    },
                    {
                        model: ProductVariant,
                        include: [{
                            model: Color
                        }, {
                            model: Size
                        }]
                    },
                    {
                        model: Order,
                        where: whereClause
                    }
                ],
                // group: ['ProductId', 'ProductVariantId'],
                order: [['createdAt', 'DESC']]
            });

            return {
                status: true,
                message: "Product statements retrieved successfully",
                data: statements
            };
        } catch (error) {
            return {
                status: false,
                message: "Error retrieving product statements",
                error: error.message
            };
        }
    }

    async getSpecificProductStatement(productId, query) {
        try {
            const whereClause = {
                ProductId: productId
            };

            // Date range filter
            if (query.startDate && query.endDate) {
                whereClause.createdAt = {
                    [Op.between]: [
                        new Date(new Date(query.startDate).setHours(0, 0, 0)),
                        new Date(new Date(query.endDate).setHours(23, 59, 59))
                    ]
                };
            }

            const statements = await OrderItem.findAll({
                where: whereClause,
                include: [
                    {
                        model: Order,
                    },
                    {
                        model: Product,
                        include: [{
                            model: Color
                        }, {
                            model: Size
                        }]
                    },
                    {
                        model: ProductVariant,
                        include: [{
                            model: Color
                        }, {
                            model: Size
                        }]
                    }
                ],
                order: [['createdAt', 'DESC']]
            });

            return {
                status: true,
                message: "Product statement retrieved successfully",
                data: statements
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
