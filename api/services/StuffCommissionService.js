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

        if (query.stuffId) {
            whereClause.UserRoleId = Number(query.stuffId);
        }

        if (query.orderId) {
            whereClause.OrderId = Number(query.orderId);
        }

        if (query.minAmount || query.maxAmount) {
            whereClause.commissionAmount = {};
            if (query.minAmount) {
                whereClause.commissionAmount[Op.gte] = Number(query.minAmount);
            }
            if (query.maxAmount) {
                whereClause.commissionAmount[Op.lte] = Number(query.maxAmount);
            }
        }

        if (query.startDate && query.endDate) {
            const start = new Date(query.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(query.endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.createdAt = {
                [Op.between]: [start, end],
            };
        }

        const { rows, count } = await StuffCommission.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: UserRole,
                    as: "staff",
                    attributes: ["id", "fullName", "email", "phone", "role"],
                },
                {
                    model: User,
                    as: "shop",
                    attributes: ["id", "businessName", "fullName", "email"],
                },
                {
                    model: Order,
                    as: "order",
                    attributes: ["id", "orderNumber", "total", "orderDate"],
                },
            ],
            order: [["createdAt", "DESC"]],
            limit: pageSize,
            offset,
        });

        return {
            status: true,
            message: "Commission history retrieved successfully",
            data: {
                items: rows,
                pagination: {
                    page,
                    pageSize,
                    totalItems: count,
                    totalPages: Math.ceil(count / pageSize),
                },
            },
        };
    },
};

module.exports = StuffCommissionService;


