const { Op } = require("sequelize");
const { StuffCommission, User, UserRole, Order } = require("../entity");

const normalizeIds = (ids = []) =>
    (ids || [])
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id));

const resolveShopFilter = (accessibleShopIds = [], requestedShopId) => {
    const normalizedIds = normalizeIds(accessibleShopIds);

    if (!requestedShopId) {
        return normalizedIds;
    }

    const parsedShopId = Number(requestedShopId);
    if (Number.isNaN(parsedShopId)) {
        const error = new Error("Invalid shopId");
        error.isClientError = true;
        throw error;
    }

    if (!normalizedIds.includes(parsedShopId)) {
        const error = new Error("Unauthorized shop access");
        error.isClientError = true;
        throw error;
    }

    return [parsedShopId];
};

const StuffCommissionService = {
    async recordFromOrder({ order, stuffId,accessibleShopIds, transaction }) {
        if (!stuffId || !order) {
            return null;
        }

        const staffId = Number(stuffId);
        if (Number.isNaN(staffId)) {
            const error = new Error("Invalid stuffId");
            error.isClientError = true;
            throw error;
        }

        console.log('staffId', staffId);

        const staff = await UserRole.findOne({
            where: {
                id: staffId,
                parentUserId: {
                    [Op.in]: accessibleShopIds,
                },
                // parentUserId: order.UserId,
            },
            transaction,
        });

        if (!staff) {
            const error = new Error("Staff not found for this shop");
            error.isClientError = true;
            throw error;
        }

        const shop = await User.findByPk(order.UserId, { transaction });

        const percentage = Number(shop?.stuffCommission || 0);
        if (!percentage || percentage <= 0) {
            return null;
        }

        const commissionAmount = Number(order.total || 0) * (percentage / 100);

        if (!commissionAmount || commissionAmount <= 0) {
            return null;
        }

        return StuffCommission.create(
            {
                baseAmount: order.total,
                commissionAmount,
                commissionPercentage: percentage,
                notes: `Auto commission for order ${order.orderNumber}`,
                UserRoleId: staff.id,
                UserId: order.UserId,
                OrderId: order.id,
            },
            { transaction }
        );
    },

    async getAll(accessibleShopIds = [], query = {}) {
        const page = parseInt(query.page, 10) || 1;
        const pageSize = parseInt(query.pageSize, 10) || 10;
        const offset = (page - 1) * pageSize;

        const targetShopIds = resolveShopFilter(accessibleShopIds, query.shopId);
        const whereClause = {
            UserId: {
                [Op.in]: targetShopIds,
            },
        };

        // Filter by staff/stuff ID
        if (query.stuffId) {
            const stuffId = Number(query.stuffId);
            if (!Number.isNaN(stuffId)) {
                whereClause.UserRoleId = stuffId;
            }
        }

        // Filter by order ID
        if (query.orderId) {
            const orderId = Number(query.orderId);
            if (!Number.isNaN(orderId)) {
                whereClause.OrderId = orderId;
            }
        }

        // Filter by commission amount range
        if (query.minAmount || query.maxAmount) {
            whereClause.commissionAmount = {};
            if (query.minAmount) {
                const minAmount = Number(query.minAmount);
                if (!Number.isNaN(minAmount)) {
                    whereClause.commissionAmount[Op.gte] = minAmount;
                }
            }
            if (query.maxAmount) {
                const maxAmount = Number(query.maxAmount);
                if (!Number.isNaN(maxAmount)) {
                    whereClause.commissionAmount[Op.lte] = maxAmount;
                }
            }
        }

        // Filter by exact commission amount
        if (query.commissionAmount) {
            const commissionAmount = Number(query.commissionAmount);
            if (!Number.isNaN(commissionAmount)) {
                whereClause.commissionAmount = commissionAmount;
            }
        }

        // Date range filter
        if (query.startDate && query.endDate) {
            const start = new Date(query.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(query.endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.createdAt = {
                [Op.between]: [start, end],
            };
        } else if (query.startDate) {
            const start = new Date(query.startDate);
            start.setHours(0, 0, 0, 0);
            whereClause.createdAt = {
                [Op.gte]: start,
            };
        } else if (query.endDate) {
            const end = new Date(query.endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.createdAt = {
                [Op.lte]: end,
            };
        }

        // Filter by staff role
        const includeStaff = {
            model: UserRole,
            as: "staff",
            attributes: ["id", "fullName", "email", "phone", "role"],
            required: false,
        };
        
        if (query.staffRole) {
            includeStaff.where = {
                role: query.staffRole,
            };
            includeStaff.required = true;
        }

        const { rows, count } = await StuffCommission.findAndCountAll({
            where: whereClause,
            include: [
                includeStaff,
                {
                    model: User,
                    as: "shop",
                    attributes: ["id", "businessName", "fullName", "email"],
                    required: false,
                },
                {
                    model: Order,
                    as: "order",
                    attributes: ["id", "orderNumber", "total", "orderDate", "paidAmount", "paymentStatus"],
                    required: false,
                },
            ],
            order: [["createdAt", "DESC"]],
            limit: pageSize,
            offset,
        });

        // Calculate summary statistics
        const summary = rows.reduce(
            (acc, commission) => {
                acc.totalCommission += Number(commission.commissionAmount || 0);
                acc.totalOrders += 1;
                return acc;
            },
            {
                totalCommission: 0,
                totalOrders: 0,
            }
        );

        summary.averageCommission =
            summary.totalOrders > 0
                ? (summary.totalCommission / summary.totalOrders).toFixed(2)
                : 0;

        return {
            status: true,
            message: "Commission history retrieved successfully",
            data: {
                items: rows,
                summary,
                pagination: {
                    page,
                    pageSize,
                    totalItems: count,
                    totalPages: Math.ceil(count / pageSize),
                    hasNextPage: page < Math.ceil(count / pageSize),
                    hasPreviousPage: page > 1,
                },
            },
        };
    },

    async getStats(accessibleShopIds = [], query = {}) {
        try {
            const targetShopIds = resolveShopFilter(accessibleShopIds, query.shopId);
            const whereClause = {
                UserId: {
                    [Op.in]: targetShopIds,
                },
            };

            // Date range filter for stats
            if (query.startDate && query.endDate) {
                const start = new Date(query.startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(query.endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.createdAt = {
                    [Op.between]: [start, end],
                };
            }

            // Filter by staff ID
            if (query.stuffId) {
                const stuffId = Number(query.stuffId);
                if (!Number.isNaN(stuffId)) {
                    whereClause.UserRoleId = stuffId;
                }
            }

            const commissions = await StuffCommission.findAll({
                where: whereClause,
                include: [
                    {
                        model: UserRole,
                        as: "staff",
                        attributes: ["id", "fullName", "role"],
                    },
                ],
            });

            const stats = commissions.reduce(
                (acc, commission) => {
                    acc.totalCommission += Number(commission.commissionAmount || 0);
                    acc.totalOrders += 1;
                    
                    const staffId = commission.UserRoleId;
                    if (!acc.byStaff[staffId]) {
                        acc.byStaff[staffId] = {
                            staffId,
                            staffName: commission.staff?.fullName || "Unknown",
                            staffRole: commission.staff?.role || "Unknown",
                            totalCommission: 0,
                            orderCount: 0,
                        };
                    }
                    acc.byStaff[staffId].totalCommission += Number(commission.commissionAmount || 0);
                    acc.byStaff[staffId].orderCount += 1;

                    return acc;
                },
                {
                    totalCommission: 0,
                    totalOrders: 0,
                    byStaff: {},
                }
            );

            // Convert byStaff object to array
            stats.byStaff = Object.values(stats.byStaff);
            stats.averageCommission =
                stats.totalOrders > 0
                    ? (stats.totalCommission / stats.totalOrders).toFixed(2)
                    : 0;

            return {
                status: true,
                message: "Commission statistics retrieved successfully",
                data: stats,
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to retrieve commission statistics",
                error: error.message,
            };
        }
    },
};

module.exports = StuffCommissionService;


