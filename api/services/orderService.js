const {
    Order,
    OrderItem,
    Product,
    ProductVariant,
    StockHistory,
    Color,
    Size,
    User,
    StuffCommission,
    UserRole,
    Category,
    Brand,
    Unit,
} = require('../entity');
const sequelize = require('../db');
const { Op, fn, col, literal } = require('sequelize');
const StuffCommissionService = require('./StuffCommissionService');

const resolveShopFilter = (accessibleShopIds = [], requestedShopId) => {
    const normalizedIds = (accessibleShopIds || [])
        .map(id => Number(id))
        .filter(id => !Number.isNaN(id));

    if (!requestedShopId) {
        return normalizedIds;
    }

    const parsedShopId = Number(requestedShopId);

    if (Number.isNaN(parsedShopId)) {
        const error = new Error('Invalid shopId');
        error.isClientError = true;
        throw error;
    }

    if (!normalizedIds.includes(parsedShopId)) {
        const error = new Error('Unauthorized shop access');
        error.isClientError = true;
        throw error;
    }

    return [parsedShopId];
};

// Service
const OrderService = {
    async create(orderData, userId, accessibleShopIds) {
        const transaction = await sequelize.transaction();
        try {
            // Validate and calculate prices for all items
            const { validatedItems, subtotal } = await this.validateOrderItems(orderData?.items, transaction, accessibleShopIds);

            const orderId = orderData?.orderId || null;
            // Calculate tax and total
            const tableNumber = orderData?.tableNumber || null;
            const guestNumber = orderData?.guestNumber || null;
            const specialNotes = orderData?.specialNotes || null;

            // const paymentStatus = orderData.paymentStatus;
            const kotPaymentStatus = orderData.kotPaymentStatus;

            const tax = orderData?.tax || 0;
            const discount = orderData?.discount || 0;
            const total = subtotal + tax - discount;

            // Handle partial payments
            const cashAmount = Number(orderData?.cashAmount || 0);
            const cardAmount = Number(orderData?.cardAmount || 0);
            const walletAmount = Number(orderData?.walletAmount || 0);
            const paidAmount = cashAmount + cardAmount + walletAmount;

            // Determine payment method and status
            let paymentMethod = orderData?.paymentMethod || "cash";
            let paymentStatus = "pending";

            if (paidAmount > 0) {
                if (paidAmount >= total) {
                    paymentStatus = "completed";
                } else {
                    paymentStatus = "partial";
                }

                // Determine payment method based on amounts
                const paymentMethods = [];
                if (cashAmount > 0) paymentMethods.push("cash");
                if (cardAmount > 0) paymentMethods.push("card");
                if (walletAmount > 0) paymentMethods.push("wallet");

                if (paymentMethods.length > 1) {
                    paymentMethod = "mixed";
                } else if (paymentMethods.length === 1) {
                    paymentMethod = paymentMethods[0];
                }
            }

            paymentStatus = kotPaymentStatus === "pending" ? "pending" : paymentStatus

            // Generate 8-digit order number (YMMDD### format)
            const orderNumber = await this.generateOrderNumber(orderData.shopId || userId, transaction);

            // For order adjustments, fetch existing order items to handle removed items
            let existingOrderItems = [];
            if (orderId) {
                existingOrderItems = await OrderItem.findAll({
                    where: { OrderId: orderId },
                    transaction
                });
            }

            let order = null;
            if (orderId) {
                order = await Order.findByPk(orderId, { transaction });
                if (!order) {
                    throw new Error(`Order with ID ${orderId} not found`);
                }

                await Order.update({
                    ...orderData,
                    customerPhone: orderData?.customerPhone || orderData?.phone || null,
                    customerEmail: orderData?.customerEmail || orderData?.email || null,
                    tableNumber,
                    guestNumber,
                    specialNotes,
                    subtotal,
                    tax,
                    discount,
                    total,
                    cashAmount,
                    cardAmount,
                    walletAmount,
                    paidAmount,
                    paymentMethod,
                    orderStatus: paymentStatus === "pending" ? "processing" : "completed",
                    paymentStatus
                }, { transaction, where: { id: orderId } });
            } else {
                // Create order
                order = await Order.create({
                    ...orderData,
                    customerPhone: orderData?.customerPhone || orderData?.phone || null,
                    customerEmail: orderData?.customerEmail || orderData?.email || null,
                    tableNumber,
                    guestNumber,
                    specialNotes,
                    orderNumber,
                    UserId: userId,
                    orderDate: new Date(),
                    subtotal,
                    tax,
                    discount,
                    total,
                    cashAmount,
                    cardAmount,
                    walletAmount,
                    paidAmount,
                    paymentMethod,
                    orderStatus: paymentStatus === "pending" ? "processing" : "completed",
                    paymentStatus
                }, { transaction });
            }

            // Identify removed items (items that existed but are not in the new data)
            // These are items the customer returned, so we need to restore their stock
            if (orderId && existingOrderItems.length > 0) {
                const newItemIds = validatedItems
                    .filter(item => item.orderItemId)
                    .map(item => item.orderItemId);

                const removedItems = existingOrderItems.filter(
                    existingItem => !newItemIds.includes(existingItem.id)
                );

                // Restore stock for removed items
                for (const removedItem of removedItems) {
                    const productId = removedItem.ProductId;
                    const variantId = removedItem.ProductVariantId;
                    const returnedQuantity = removedItem.quantity;

                    if (variantId) {
                        const variant = await ProductVariant.findByPk(variantId, { transaction });
                        if (variant) {
                            const previousStock = variant.quantity;
                            const newStock = previousStock + returnedQuantity;

                            await variant.update({ quantity: newStock }, { transaction });
                            await StockHistory.create({
                                type: 'adjustment',
                                quantity: returnedQuantity,
                                previousStock,
                                newStock,
                                ProductId: productId,
                                ProductVariantId: variantId,
                                OrderId: order.id,
                                UserId: userId,
                                note: `Order ${order.orderNumber} - Item returned (removed from order)`
                            }, { transaction });
                        }
                    } else {
                        const product = await Product.findByPk(productId, { transaction });
                        if (product) {
                            const previousStock = product.stock;
                            const newStock = previousStock + returnedQuantity;

                            await product.update({ stock: newStock }, { transaction });
                            await StockHistory.create({
                                type: 'adjustment',
                                quantity: returnedQuantity,
                                previousStock,
                                newStock,
                                ProductId: productId,
                                OrderId: order.id,
                                UserId: userId,
                                note: `Order ${order.orderNumber} - Item returned (removed from order)`
                            }, { transaction });
                        }
                    }

                    // Delete the removed order item
                    await removedItem.destroy({ transaction });
                }
            }

            // Process order items and update stock
            for (const item of validatedItems) {
                const {
                    orderItemId,
                    productId,
                    variantId,
                    quantity,
                    unitPrice,
                    discount,
                    subtotal,
                    currentStock,
                    variant,
                    product,
                    discountType,
                    discountAmount
                } = item;

                let stockAdjustment = 0;
                let previousOrderQuantity = 0;

                if (orderItemId) {
                    // Updating existing order item
                    const existingOrderItem = await OrderItem.findByPk(orderItemId, { transaction });

                    if (!existingOrderItem) {
                        throw new Error(`Order item with ID ${orderItemId} not found`);
                    }

                    // Calculate stock adjustment based on quantity change
                    previousOrderQuantity = existingOrderItem.quantity;
                    stockAdjustment = quantity - previousOrderQuantity;

                    await OrderItem.update({
                        ProductId: productId,
                        ProductVariantId: variantId,
                        quantity,
                        unitPrice: unitPrice,
                        discountAmount: discountAmount,
                        originalUnitPrice: product.price,
                        subtotal,
                        discountType,
                        unitDiscount: discount,
                        totalDiscount: discount * quantity,
                        purchasePrice: Number(product?.purchasePrice || 0),
                    }, { transaction, where: { id: orderItemId } });
                } else {
                    // Creating new order item
                    stockAdjustment = quantity;

                    await OrderItem.create({
                        OrderId: order.id,
                        ProductId: productId,
                        ProductVariantId: variantId,
                        quantity,
                        unitPrice: unitPrice,
                        discountAmount: discountAmount,
                        originalUnitPrice: product.price,
                        subtotal,
                        discountType,
                        unitDiscount: discount,
                        totalDiscount: discount * quantity,
                        purchasePrice: Number(product?.purchasePrice || 0),
                    }, { transaction });
                }

                // Update stock based on adjustment
                // Positive stockAdjustment means we need to reduce stock (more items ordered)
                // Negative stockAdjustment means we need to increase stock (fewer items ordered)
                if (stockAdjustment !== 0) {
                    const newStock = currentStock - stockAdjustment;

                    // Ensure stock never goes negative
                    if (newStock < 0) {
                        throw new Error(
                            `Stock cannot be negative for ${variantId ? 'variant' : 'product'} ${variantId || productId}. ` +
                            `Current stock: ${currentStock}, Attempted adjustment: ${stockAdjustment}`
                        );
                    }

                    const stockNote = orderItemId
                        ? `Order ${order.orderNumber} - Adjusted (${previousOrderQuantity} → ${quantity})`
                        : `Order ${order.orderNumber} - New item`;

                    if (variantId && variant) {
                        await variant.update({ quantity: newStock }, { transaction });
                        await StockHistory.create({
                            type: orderItemId ? 'adjustment' : 'order',
                            quantity: Math.abs(stockAdjustment),
                            previousStock: currentStock,
                            newStock,
                            ProductId: productId,
                            ProductVariantId: variantId,
                            OrderId: order.id,
                            UserId: userId,
                            note: stockNote
                        }, { transaction });
                    } else {
                        await product.update({ stock: newStock }, { transaction });
                        await StockHistory.create({
                            type: orderItemId ? 'adjustment' : 'order',
                            quantity: Math.abs(stockAdjustment),
                            previousStock: currentStock,
                            newStock,
                            ProductId: productId,
                            OrderId: order.id,
                            UserId: userId,
                            note: stockNote
                        }, { transaction });
                    }
                }
            }

            // Handle commission - each order should only have one staff commission
            if (orderData?.stuffId && orderData.stuffId.toString().trim() !== '') {
                try {
                    // If updating an existing order, delete old commissions first
                    if (orderId) {
                        await StuffCommission.destroy({
                            where: { OrderId: orderId },
                            transaction
                        });
                    }

                    // Create new commission
                    await StuffCommissionService.recordFromOrder({
                        order,
                        stuffId: Number(orderData.stuffId),
                        accessibleShopIds,
                        transaction,
                    });
                } catch (commissionError) {
                    // Log commission error but don't fail the order creation
                    console.error('Commission creation error:', commissionError.message);
                    // Optionally, you might want to handle this differently
                }
            } else if (orderId) {
                // If no stuffId provided but updating order, remove any existing commissions
                try {
                    await StuffCommission.destroy({
                        where: { OrderId: orderId },
                        transaction
                    });
                } catch (commissionError) {
                    console.error('Commission deletion error:', commissionError.message);
                }
            }

            await transaction.commit();

            return {
                status: true,
                message: "Order created successfully",
                data: {
                    ...order.toJSON(),
                    items: validatedItems
                }
            };

        } catch (error) {
            await transaction.rollback();
            return {
                status: false,
                message: "Failed to create order",
                error: error.message,
                ...error,
            };
        }
    },



    async getAll(query = {}, accessibleShopIds) {
        try {
            const page = parseInt(query.page) || 1;
            const pageSize = parseInt(query.pageSize) || 10;
            const offset = (page - 1) * pageSize;

            // Build where clause
            const targetShopIds = resolveShopFilter(accessibleShopIds, query.shopId);
            const whereClause = { UserId: { [Op.in]: targetShopIds } };

            // Add search functionality
            if (query.searchKey) {
                whereClause[Op.or] = [
                    { orderNumber: { [Op.like]: `%${query.searchKey}%` } },
                    { customerName: { [Op.like]: `%${query.searchKey}%` } },
                    { customerPhone: { [Op.like]: `%${query.searchKey}%` } },
                    { customerEmail: { [Op.like]: `%${query.searchKey}%` } }
                ];
            }

            if (query?.shopId) {
                whereClause.UserId = query?.shopId
            }

            // Add other filters if provided
            if (query.orderStatus) whereClause.orderStatus = query.orderStatus;
            if (query.paymentStatus) whereClause.paymentStatus = query.paymentStatus;
            if (query.paymentMethod) whereClause.paymentMethod = query.paymentMethod;

            // Add date range filter if provided
            if (query.startDate && query.endDate) {
                whereClause.orderDate = {
                    [Op.between]: [
                        new Date(new Date(query.startDate).setHours(0, 0, 0)),
                        new Date(new Date(query.endDate).setHours(23, 59, 59))
                    ]
                };
            }

            // Get total count for pagination
            const totalCount = await Order.count({ where: whereClause });
            const totalPages = Math.ceil(totalCount / pageSize);

            // Get paginated orders with related data
            const orders = await Order.findAll({
                where: whereClause,
                include: [{
                    model: OrderItem,
                    include: [
                        {
                            model: Product,
                            attributes: ['name', 'sku']
                        },
                        {
                            model: ProductVariant,
                            include: [
                                { model: Color, attributes: ['name'] },
                                { model: Size, attributes: ['name'] }
                            ]
                        }
                    ]
                },
                {
                    model: StuffCommission,
                    as: "commissions",
                    include: [{
                        model: UserRole,
                        as: "staff",
                        include: [{
                            model: User,
                            as: "parent"
                        }]
                    }]
                }
                ],
                order: [['orderDate', 'DESC']],
                limit: pageSize,
                offset: offset
            });

            // Calculate order-wise statistics
            const ordersWithStats = orders.map(order => {
                const orderData = order.toJSON();

                // Calculate total cost, profit, and loss from order items
                let totalCost = 0;
                let totalProfit = 0;
                let totalLoss = 0;

                // Calculate total commission from commissions
                let totalCommission = 0;
                if (orderData.commissions && orderData.commissions.length > 0) {
                    totalCommission = orderData.commissions.reduce((sum, commission) => {
                        return sum + Number(commission.commissionAmount || 0);
                    }, 0);
                }

                if (orderData.OrderItems && orderData.OrderItems.length > 0) {
                    orderData.OrderItems.forEach(item => {
                        const quantity = Number(item.quantity || 0);
                        const subtotal = Number(item.subtotal || 0);
                        // Use purchasePrice directly from OrderItem
                        const purchasePrice = Number(item.purchasePrice || 0);

                        // Calculate cost for this item
                        const itemCost = purchasePrice * quantity;
                        totalCost += itemCost;

                        // Calculate profit/loss for this item
                        const itemProfit = subtotal - itemCost;

                        if (itemProfit >= 0) {
                            totalProfit += itemProfit;
                        } else {
                            totalLoss += Math.abs(itemProfit);
                        }
                    });
                }



                // Add calculated fields to order data
                return {
                    ...orderData,
                    totalCost: Number(totalCost.toFixed(2)),
                    totalProfit: Number(totalProfit.toFixed(2)),
                    totalLoss: Number(totalLoss.toFixed(2)),
                    totalCommission: Number(totalCommission.toFixed(2))
                };
            });

            return {
                status: true,
                message: "Orders retrieved successfully",
                data: {
                    orders: ordersWithStats,
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
                message: error.isClientError ? error.message : "Failed to retrieve orders",
                error: error.message
            };
        }
    },

    async getById(orderId) {

        const order = await Order.findOne({
            where: {
                id: Number(orderId)
            },
            include: [{
                model: OrderItem,
                include: [{ model: Product, include: [{ model: Color }, { model: Size }, { model: Unit }, { model: Brand }] }, {
                    model: ProductVariant, include: [
                        { model: Product, include: [{ model: Color }, { model: Size }, { model: Brand }, { model: Unit }] },
                        { model: Color }, { model: Size }]
                }]
            },
            {
                model: StuffCommission,
                as: "commissions",
                include: [{
                    model: UserRole,
                    as: "staff",
                    include: [{
                        model: User,
                        as: "parent"
                    }]
                }]
            }

            ]
        });
        console.log(order);
        if (!order) {
            return { status: false, message: 'Order not found', data: null };
        }
        return { status: true, message: 'Order retrieved successfully', data: order };
    },

    async delete(orderId, accessibleShopIds = []) {
        const transaction = await sequelize.transaction();

        try {
            // Find the order with its items first
            const order = await Order.findByPk(orderId, {
                include: [{
                    model: OrderItem,
                    include: [
                        { model: Product },
                        { model: ProductVariant }
                    ]
                }],
                transaction
            });

            if (!order) {
                await transaction.rollback();
                return { status: false, message: 'Order not found' };
            }

            // Check shop access if accessibleShopIds is provided
            if (accessibleShopIds && accessibleShopIds.length > 0) {
                if (!accessibleShopIds.includes(order.UserId)) {
                    await transaction.rollback();
                    return { status: false, message: 'You do not have permission to delete this order' };
                }
            }

            // Restore stock for all order items
            if (order.OrderItems && order.OrderItems.length > 0) {
                for (const orderItem of order.OrderItems) {
                    const productId = orderItem.ProductId;
                    const variantId = orderItem.ProductVariantId;
                    const quantity = orderItem.quantity;

                    // Restore stock for variant or product
                    if (variantId) {
                        const variant = await ProductVariant.findByPk(variantId, { transaction });
                        if (variant) {
                            const previousStock = variant.quantity;
                            const newStock = previousStock + quantity;

                            await variant.update({ quantity: newStock }, { transaction });

                            // Create stock history record
                            await StockHistory.create({
                                type: 'adjustment',
                                quantity: quantity,
                                previousStock,
                                newStock,
                                ProductId: productId,
                                ProductVariantId: variantId,
                                OrderId: order.id,
                                UserId: order.UserId,
                                note: `Order ${order.orderNumber} deleted - Stock restored`
                            }, { transaction });
                        }
                    } else if (productId) {
                        const product = await Product.findByPk(productId, { transaction });
                        if (product) {
                            const previousStock = product.stock;
                            const newStock = previousStock + quantity;

                            await product.update({ stock: newStock }, { transaction });

                            // Create stock history record
                            await StockHistory.create({
                                type: 'adjustment',
                                quantity: quantity,
                                previousStock,
                                newStock,
                                ProductId: productId,
                                OrderId: order.id,
                                UserId: order.UserId,
                                note: `Order ${order.orderNumber} deleted - Stock restored`
                            }, { transaction });
                        }
                    }
                }
            }

            // Delete all associated StuffCommissions
            const deletedCommissions = await StuffCommission.destroy({
                where: { OrderId: orderId },
                transaction
            });

            // Delete all associated OrderItems
            const deletedItems = await OrderItem.destroy({
                where: { OrderId: orderId },
                transaction
            });

            // Delete the order itself
            await order.destroy({ transaction });

            // Commit the transaction
            await transaction.commit();

            return {
                status: true,
                message: 'Order deleted successfully and stock restored',
                data: {
                    deletedOrder: orderId,
                    deletedItems,
                    deletedCommissions,
                    stockRestored: order.OrderItems.length
                }
            };
        } catch (error) {
            await transaction.rollback();
            return { status: false, message: 'Failed to delete order', error: error.message };
        }
    },

    async deleteMany(payload, accessibleShopIds) {
        const transaction = await sequelize.transaction();

        try {
            let whereClause = {};

            // 1. Determine which orders to delete
            if (payload.ids && Array.isArray(payload.ids) && payload.ids.length > 0) {
                // Delete specific IDs
                whereClause.id = { [Op.in]: payload.ids };

                // Also apply shop filter for security
                const targetShopIds = resolveShopFilter(accessibleShopIds, payload.shopId);
                whereClause.UserId = { [Op.in]: targetShopIds };

            } else if (payload.all) {
                // Delete based on filters (reuse getAll logic)
                const targetShopIds = resolveShopFilter(accessibleShopIds, payload.shopId);
                whereClause = { UserId: { [Op.in]: targetShopIds } };

                // Add search functionality
                if (payload.searchKey) {
                    whereClause[Op.or] = [
                        { orderNumber: { [Op.like]: `%${payload.searchKey}%` } },
                        { customerName: { [Op.like]: `%${payload.searchKey}%` } },
                        { customerPhone: { [Op.like]: `%${payload.searchKey}%` } },
                        { customerEmail: { [Op.like]: `%${payload.searchKey}%` } }
                    ];
                }

                if (payload.shopId) {
                    whereClause.UserId = payload.shopId
                }

                // Add other filters
                if (payload.orderStatus) whereClause.orderStatus = payload.orderStatus;
                if (payload.paymentStatus) whereClause.paymentStatus = payload.paymentStatus;
                if (payload.paymentMethod) whereClause.paymentMethod = payload.paymentMethod;

                // Add date range filter
                if (payload.startDate && payload.endDate) {
                    whereClause.orderDate = {
                        [Op.between]: [
                            new Date(new Date(payload.startDate).setHours(0, 0, 0)),
                            new Date(new Date(payload.endDate).setHours(23, 59, 59))
                        ]
                    };
                }
            } else {
                throw new Error("Invalid delete request: provide 'ids' or 'all' with filters");
            }

            // 2. Fetch orders with items for stock restoration
            const orders = await Order.findAll({
                where: whereClause,
                include: [{
                    model: OrderItem,
                    include: [
                        { model: Product },
                        { model: ProductVariant }
                    ]
                }],
                transaction
            });

            if (!orders || orders.length === 0) {
                await transaction.rollback();
                return { status: false, message: 'No orders found to delete' };
            }

            // 3. Process deletion and stock restoration for each order
            let deletedCount = 0;

            for (const order of orders) {
                // Restore stock for all order items
                if (order.OrderItems && order.OrderItems.length > 0) {
                    for (const orderItem of order.OrderItems) {
                        const productId = orderItem.ProductId;
                        const variantId = orderItem.ProductVariantId;
                        const quantity = orderItem.quantity;

                        if (variantId) {
                            const variant = await ProductVariant.findByPk(variantId, { transaction });
                            if (variant) {
                                await variant.increment('quantity', { by: quantity, transaction });

                                await StockHistory.create({
                                    type: 'adjustment',
                                    quantity: quantity,
                                    previousStock: variant.quantity,
                                    newStock: variant.quantity + quantity,
                                    ProductId: productId,
                                    ProductVariantId: variantId,
                                    OrderId: order.id,
                                    UserId: order.UserId,
                                    note: `Order ${order.orderNumber} deleted (Bulk) - Stock restored`
                                }, { transaction });
                            }
                        } else if (productId) {
                            const product = await Product.findByPk(productId, { transaction });
                            if (product) {
                                await product.increment('stock', { by: quantity, transaction });

                                await StockHistory.create({
                                    type: 'adjustment',
                                    quantity: quantity,
                                    previousStock: product.stock,
                                    newStock: product.stock + quantity,
                                    ProductId: productId,
                                    OrderId: order.id,
                                    UserId: order.UserId,
                                    note: `Order ${order.orderNumber} deleted (Bulk) - Stock restored`
                                }, { transaction });
                            }
                        }
                    }
                }

                deletedCount++;
            }

            // Delete associations and orders in bulk
            const orderIds = orders.map(o => o.id);

            await StuffCommission.destroy({
                where: { OrderId: { [Op.in]: orderIds } },
                transaction
            });

            await OrderItem.destroy({
                where: { OrderId: { [Op.in]: orderIds } },
                transaction
            });

            await Order.destroy({
                where: { id: { [Op.in]: orderIds } },
                transaction
            });

            await transaction.commit();

            return {
                status: true,
                message: `${deletedCount} orders deleted successfully`,
                data: {
                    deletedCount,
                    shopId: payload.shopId
                }
            };

        } catch (error) {
            await transaction.rollback();
            return { status: false, message: 'Failed to delete orders', error: error.message };
        }
    },

    async getCustomerOrders(customerId, accessibleShopIds) {
        try {
            const orders = await Order.findAll({
                where: {
                    UserId: { [Op.in]: accessibleShopIds },
                    customerPhone: customerId
                },
                include: [{
                    model: OrderItem,
                    include: [
                        { model: Product },
                        { model: ProductVariant }
                    ]
                }],
                order: [['orderDate', 'DESC']]
            });

            return {
                status: true,
                message: "Customer orders retrieved successfully",
                data: orders
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to retrieve customer orders",
                error: error.message
            };
        }
    },

    async getDashboardStats(accessibleShopIds, dateRange = {}) {
        try {
            const targetShopIds = resolveShopFilter(accessibleShopIds, dateRange.shopId);
            const whereClause = {
                UserId: { [Op.in]: targetShopIds },
                orderStatus: 'completed'
            };

            // Apply date range filter
            if (dateRange?.startDate && dateRange?.endDate) {
                const start = new Date(dateRange.startDate);
                start.setHours(0, 0, 0, 0);

                const end = new Date(dateRange.endDate);
                end.setHours(23, 59, 59, 999);

                whereClause.orderDate = {
                    [Op.between]: [start, end]
                };
            }

            // Validate shopIds to prevent errors
            if (!targetShopIds || targetShopIds.length === 0) {
                return {
                    status: true,
                    message: "Dashboard statistics retrieved successfully",
                    data: {
                        totalSales: 0,
                        totalOrders: 0,
                        totalProfit: 0,
                        totalLoss: 0,
                        totalDiscount: 0,
                        orderLevelDiscount: 0,
                        itemLevelDiscount: 0,
                        totalTax: 0,
                        totalCommissions: 0,
                        totalProducts: 0
                    }
                };
            }

            // Filter out any invalid IDs
            const validShopIds = targetShopIds.filter(id => {
                const numId = Number(id);
                return !Number.isNaN(numId) && numId > 0;
            });

            if (validShopIds.length === 0) {
                return {
                    status: true,
                    message: "Dashboard statistics retrieved successfully",
                    data: {
                        totalSales: 0,
                        totalOrders: 0,
                        totalProfit: 0,
                        totalLoss: 0,
                        totalDiscount: 0,
                        orderLevelDiscount: 0,
                        itemLevelDiscount: 0,
                        totalTax: 0,
                        totalCommissions: 0,
                        totalProducts: 0
                    }
                };
            }

            // Update whereClause with validated IDs
            whereClause.UserId = { [Op.in]: validShopIds };

            // Optimized: Use database aggregation for order-level stats
            const orderStats = await Order.findOne({
                where: whereClause,
                attributes: [
                    [fn('SUM', col('Order.total')), 'totalSales'],
                    [fn('COUNT', col('Order.id')), 'totalOrders'],
                    [fn('SUM', col('Order.discount')), 'orderLevelDiscount'],
                    [fn('SUM', col('Order.tax')), 'totalTax']
                ],
                raw: true
            });

            console.log({ orderStats })

            // Optimized: Use database aggregation for order item stats
            // Get table names and escape them properly for MySQL
            const OrderTableName = Order.getTableName();
            const OrderItemTableName = OrderItem.getTableName();
            const ProductTableName = Product.getTableName();

            // Build placeholders for IN clause to prevent SQL injection
            const shopIdPlaceholders = validShopIds.map((_, idx) => `:shopId${idx}`).join(', ');
            const queryParams = {};
            validShopIds.forEach((id, idx) => {
                queryParams[`shopId${idx}`] = Number(id);
            });

            let dateCondition = '';
            if (dateRange?.startDate && dateRange?.endDate) {
                const start = new Date(dateRange.startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(dateRange.endDate);
                end.setHours(23, 59, 59, 999);
                dateCondition = 'AND o.orderDate BETWEEN :startDate AND :endDate';
                queryParams.startDate = start;
                queryParams.endDate = end;
            }

            const itemStatsQuery = `
                SELECT 
                    COALESCE(SUM(oi.unitPrice * oi.quantity), 0) as totalRevenue,
                    COALESCE(SUM(COALESCE(oi.purchasePrice, p.purchasePrice, 0) * oi.quantity), 0) as totalCost,
                    COALESCE(SUM(COALESCE(oi.unitDiscount * oi.quantity, oi.totalDiscount, 0)), 0) as itemLevelDiscount
                FROM \`${OrderItemTableName}\` oi
                INNER JOIN \`${OrderTableName}\` o ON oi.OrderId = o.id
                LEFT JOIN \`${ProductTableName}\` p ON oi.ProductId = p.id
                WHERE o.UserId IN (${shopIdPlaceholders})
                    AND o.orderStatus = 'completed'
                    ${dateCondition}
            `;

            const [itemStatsResult] = await sequelize.query(itemStatsQuery, {
                replacements: queryParams,
                type: sequelize.QueryTypes.SELECT
            });

            console.log({ itemStatsResult })

            const itemStats = itemStatsResult || { totalRevenue: 0, totalCost: 0, itemLevelDiscount: 0 };

            // Get total commissions with same filters
            const commissionWhereClause = {
                UserId: { [Op.in]: validShopIds }
            };

            if (dateRange?.startDate && dateRange?.endDate) {
                const start = new Date(dateRange.startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(dateRange.endDate);
                end.setHours(23, 59, 59, 999);
                commissionWhereClause.createdAt = {
                    [Op.between]: [start, end]
                };
            }

            const totalCommissions = await StuffCommission.sum('commissionAmount', {
                where: commissionWhereClause
            }) || 0;

            // Get total products with same shop filters (no date filter for products)
            const productWhereClause = {
                UserId: { [Op.in]: validShopIds },
                status: 'active'
            };

            const totalProducts = await Product.count({
                where: productWhereClause
            }) || 0;

            // Extract and calculate statistics
            const totalSales = Number(orderStats?.totalSales || 0);
            const totalOrders = Number(orderStats?.totalOrders || 0);
            const orderLevelDiscount = Number(orderStats?.orderLevelDiscount || 0);
            const totalTax = Number(orderStats?.totalTax || 0);

            const totalRevenue = Number(itemStats?.totalRevenue || 0);
            const totalCost = Number(itemStats?.totalCost || 0);
            const itemLevelDiscount = Number(itemStats?.itemLevelDiscount || 0);

            // Calculate total discount (order-level + item-level)
            const totalDiscount = orderLevelDiscount + itemLevelDiscount;

            // Calculate profit/loss
            const netProfit = totalRevenue - totalCost;
            const totalProfit = netProfit >= 0 ? netProfit : 0;
            const totalLoss = netProfit < 0 ? Math.abs(netProfit) : 0;

            const stats = {
                totalSales: Number(totalSales.toFixed(2)),
                totalOrders: Number(totalOrders),
                totalProfit: Number(totalProfit.toFixed(2)),
                totalLoss: Number(totalLoss.toFixed(2)),
                totalDiscount: Number(totalDiscount.toFixed(2)),
                orderLevelDiscount: Number(orderLevelDiscount.toFixed(2)),
                itemLevelDiscount: Number(itemLevelDiscount.toFixed(2)),
                totalTax: Number(totalTax.toFixed(2)),
                totalCommissions: Number(totalCommissions.toFixed(2)),
                totalProducts: Number(totalProducts)
            };

            return {
                status: true,
                message: "Dashboard statistics retrieved successfully",
                data: stats
            };
        } catch (error) {
            console.error('getDashboardStats error:', error);
            return {
                status: false,
                message: error.isClientError ? error.message : "Failed to retrieve dashboard statistics",
                error: error.message
            };
        }
    },

    async getSalesReport(accessibleShopIds, query = {}) {
        try {
            const targetShopIds = resolveShopFilter(accessibleShopIds, query.shopId);
            const whereClause = { UserId: { [Op.in]: targetShopIds } };
            if (query.startDate && query.endDate) {
                const start = new Date(query.startDate);
                start.setHours(0, 0, 0, 0); // Start of the day

                const end = new Date(query.endDate);
                end.setHours(23, 59, 59, 999); // End of the day

                whereClause.orderDate = {
                    [Op.between]: [start, end]
                };
            }


            const orders = await Order.findAll({
                where: whereClause,
                include: [{
                    model: OrderItem,
                    include: [
                        {
                            model: Product,
                            attributes: ['name', 'sku', 'purchasePrice']
                        },
                        {
                            model: ProductVariant,
                            attributes: ['sku']
                        }
                    ]
                }],
                order: [['orderDate', 'DESC']]
            });

            const report = orders.map(order => ({
                orderNumber: order.orderNumber,
                orderDate: order.orderDate,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                items: order.OrderItems.map(item => ({
                    product: item.Product ? item.Product.name : `Variant: ${item.ProductVariant.sku}`,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    subtotal: item.subtotal,
                    profit: (item.unitPrice - (item?.purchasePrice || item?.Product?.purchasePrice)) * item.quantity
                })),
                subtotal: order.subtotal,
                tax: order.tax,
                discount: order.discount,
                total: order.total,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus
            }));

            return {
                status: true,
                message: "Sales report generated successfully",
                data: report
            };
        } catch (error) {
            return {
                status: false,
                message: error.isClientError ? error.message : "Failed to generate sales report",
                error: error.message
            };
        }
    },

    async generateInvoice(orderId, accessibleShopIds) {
        try {

            const order = await Order.findOne({
                where: {
                    id: Number(orderId),
                    UserId: { [Op.in]: accessibleShopIds }
                },
                include: [{
                    model: OrderItem,
                    include: [
                        {
                            model: Product,
                            include: [
                                { model: Color },
                                { model: User },
                                { model: Size }
                            ]
                        },
                        {
                            model: ProductVariant,
                            include: [
                                { model: Product },
                                { model: Color },
                                { model: Size }
                            ]
                        }
                    ]
                }]
            });

            if (!order) {
                return {
                    status: false,
                    message: "Order not found",
                    error: "Order not found or unauthorized"
                };
            }

            const userData = await User.findByPk(order.UserId);

            // Format invoice data with full order details
            const invoiceData = {
                invoiceNumber: `INV-${order.orderNumber}`,
                orderNumber: order?.orderNumber,
                date: order?.orderDate,
                orderStatus: order?.orderStatus,
                specialNotes: order?.specialNotes,
                guestNumber: order?.guestNumber,
                tableNumber: order?.tableNumber,

                // Full order details
                order: {
                    id: order.id,
                    orderNumber: order.orderNumber,
                    orderDate: order.orderDate,
                    orderStatus: order.orderStatus,
                    subtotal: Number(order.subtotal),
                    tax: Number(order.tax),
                    discount: Number(order.discount),
                    total: Number(order.total)
                },

                // Customer details
                customer: {
                    name: order.customerName || 'Guest Customer',
                    phone: order.customerPhone || 'N/A',
                    email: order.customerEmail || 'N/A'
                },

                // Shop/User details
                shop: {
                    id: userData?.id,
                    fullName: userData?.fullName,
                    businessName: userData?.businessName || "FG-POS",
                    businessType: userData?.businessType,
                    location: userData?.location || "162/26 NaNai Road, PaTong, Kathu, Phuket- 83150, Thailand.",
                    phoneNumber: userData?.phoneNumber || "+66910414319",
                    email: userData?.email || "support@fashiongloryltd.com",
                    accountStatus: userData?.accountStatus,
                    accountType: userData?.accountType,
                    shopType: userData?.shopType
                },

                // Product-wise details
                items: order.OrderItems.map(item => {
                    let productName, sku, details, purchasePrice, salesPrice, vat, productImage;
                    let colorName, sizeName, variantDetails = null;
                    let shop;

                    // Extract discount information from OrderItem
                    const discountType = item.discountType || null;
                    const unitDiscount = Number(item.unitDiscount || 0);
                    const discountAmount = Number(item.discountAmount || 0);
                    const totalDiscount = unitDiscount * item.quantity;

                    if (item.ProductVariant) {
                        productName = item.ProductVariant?.Product?.name || "";
                        sku = item?.ProductVariant?.sku;
                        colorName = item?.ProductVariant?.Color?.name;
                        sizeName = item?.ProductVariant?.Size?.name;

                        // Build details string with discount info
                        let detailParts = [];
                        if (userData?.shopType === 'restaurant') {
                            if (sizeName) {
                                detailParts.push(sizeName);
                            }
                        } else if (colorName || sizeName) {
                            detailParts.push(colorName && sizeName ? `${colorName} - ${sizeName}` : (colorName || sizeName));
                        }
                        if (discountType && discountAmount > 0) {
                            const discountText = discountType === 'percentage'
                                ? `${discountAmount}% off`
                                : `฿${discountAmount.toFixed(2)} off`;
                            detailParts.push(`Discount: ${discountText}`);
                        }
                        details = detailParts.join(' | ') || '';

                        purchasePrice = Number(item?.purchasePrice || item.ProductVariant?.Product?.purchasePrice || 0);
                        salesPrice = Number(item.ProductVariant?.Product?.salesPrice || 0);
                        vat = Number(item.ProductVariant?.Product?.vat || 0);
                        productImage = item.ProductVariant?.imageUrl || item.ProductVariant?.Product?.productImage;
                        variantDetails = {
                            variantId: item.ProductVariant?.id,
                            variantSku: item.ProductVariant?.sku,
                            color: userData?.shopType === 'restaurant' ? null : colorName,
                            size: sizeName
                        };
                        shop = item.Product?.User
                    }
                    else if (item.Product) {
                        productName = item?.Product?.name;
                        sku = item?.Product?.sku;
                        colorName = item?.Product?.Color?.name;
                        sizeName = item?.Product?.Size?.name;

                        // Build details string with discount info
                        let detailParts = [];
                        if (userData?.shopType === 'restaurant') {
                            if (sizeName) {
                                detailParts.push(sizeName);
                            }
                        } else if (colorName || sizeName) {
                            detailParts.push(colorName && sizeName ? `${colorName} - ${sizeName}` : (colorName || sizeName));
                        }
                        if (discountType && discountAmount > 0) {
                            const discountText = discountType === 'percentage'
                                ? `${discountAmount}% off`
                                : `฿${discountAmount.toFixed(2)} off`;
                            detailParts.push(`Discount: ${discountText}`);
                        }
                        details = detailParts.join(' | ') || '';

                        purchasePrice = Number(item?.purchasePrice || item?.Product?.purchasePrice || 0);
                        salesPrice = Number(item?.originalUnitPrice || item?.Product?.price || 0);
                        vat = Number(item?.Product?.vat || 0);
                        productImage = item?.Product?.productImage;
                        shop = item.Product?.User
                    }

                    const unitPrice = Number(item.unitPrice);
                    const quantity = Number(item.quantity);
                    const itemSubtotal = Number(item.subtotal);
                    const itemCost = purchasePrice * quantity;

                    // Calculate original price before discount (salesPrice is the base price)
                    const originalUnitPrice = salesPrice || unitPrice;
                    const originalSubtotal = originalUnitPrice * quantity;

                    // Calculate profit (using subtotal which already includes discount)
                    const itemProfit = itemSubtotal - itemCost;
                    const itemProfitMargin = itemSubtotal > 0 ? ((itemProfit / itemSubtotal) * 100).toFixed(2) : '0.00';

                    return {
                        id: item.id,
                        productId: item.ProductId,
                        variantId: item.ProductVariantId,
                        productName,
                        sku,
                        details,
                        color: userData?.shopType === 'restaurant' ? null : colorName,
                        size: sizeName,
                        quantity,
                        unitPrice,
                        originalUnitPrice,
                        subtotal: itemSubtotal,
                        originalSubtotal,
                        purchasePrice,
                        salesPrice,
                        vat,
                        productImage,
                        // Discount information
                        discount: {
                            type: discountType,
                            unitDiscount,
                            totalDiscount,
                            hasDiscount: discountType && (unitDiscount > 0 || totalDiscount > 0),
                            discountAmount: discountAmount
                        },
                        itemCost,
                        itemProfit: Number(itemProfit.toFixed(2)),
                        itemProfitMargin: itemProfitMargin + '%',
                        variantDetails,
                        shop
                    };
                }),

                // Summary
                summary: {
                    subtotal: Number(order.subtotal),
                    tax: Number(order.tax),
                    taxRate: order.subtotal > 0 ? ((order.tax / order.subtotal) * 100).toFixed(2) + '%' : '0%',
                    discount: Number(order.discount),
                    discountRate: order.subtotal > 0 && order.discount > 0 ?
                        ((order.discount / order.subtotal) * 100).toFixed(2) + '%' : '0%',
                    total: Number(order.total)
                },

                // Full payment details
                payment: {
                    method: order.paymentMethod,
                    status: order.paymentStatus,
                    cashAmount: Number(order.cashAmount || 0),
                    cardAmount: Number(order.cardAmount || 0),
                    walletAmount: Number(order.walletAmount || 0),
                    paidAmount: Number(order.paidAmount || 0),
                    totalAmount: Number(order.total),
                    remainingAmount: Number((order.total - (order.paidAmount || 0)).toFixed(2)),
                    isPaid: order.paymentStatus === 'completed',
                    isPartial: order.paymentStatus === 'partial'
                },

                // Business info
                businessInfo: {
                    name: userData?.businessName || "FG-POS",
                    address: userData?.location || "162/26 NaNai Road, PaTong, Kathu, Phuket- 83150, Thailand.",
                    phone: userData?.phoneNumber || "+66910414319",
                    email: userData?.email || "support@fashiongloryltd.com",
                    website: "https://fashion-glory-pos-system.vercel.app",
                    taxId: "123456"
                }
            };

            // Calculate additional statistics
            const totalItems = order.OrderItems.reduce((sum, item) => sum + item.quantity, 0);
            const totalCost = order.OrderItems.reduce((sum, item) => {
                const itemPurchasePrice = Number(item?.purchasePrice || item?.Product?.purchasePrice || 0);
                return sum + (itemPurchasePrice * item.quantity);
            }, 0);

            // Calculate total item-level discounts
            const totalItemDiscounts = order.OrderItems.reduce((sum, item) => {
                const itemTotalDiscount = Number(item.totalDiscount || 0);
                const itemUnitDiscount = Number(item.unitDiscount || 0);
                const quantity = Number(item.quantity || 0);
                // Use totalDiscount if available, otherwise calculate from unitDiscount
                return sum + (itemTotalDiscount > 0 ? itemTotalDiscount : (itemUnitDiscount * quantity));
            }, 0);

            const totalProfit = Number(order.total) - totalCost;
            const profitMargin = order.total > 0 ? ((totalProfit / order.total) * 100).toFixed(2) : '0.00';

            const stats = {
                totalItems,
                totalUniqueItems: order.OrderItems.length,
                averageItemPrice: totalItems > 0 ? (Number(order.subtotal) / totalItems).toFixed(2) : '0.00',
                totalCost: Number(totalCost.toFixed(2)),
                totalProfit: Number(totalProfit.toFixed(2)),
                profitMargin: profitMargin + '%',
                totalItemDiscounts: Number(totalItemDiscounts.toFixed(2))
            };

            return {
                status: true,
                message: "Invoice generated successfully",
                data: {
                    ...invoiceData,
                    stats
                }
            };

        } catch (error) {
            return {
                status: false,
                message: "Failed to generate invoice",
                error: error.message
            };
        }
    },

    async getTopSellingItems(accessibleShopIds, query = {}) {
        try {
            const targetShopIds = resolveShopFilter(accessibleShopIds, query.shopId);
            const whereClause = { UserId: { [Op.in]: targetShopIds } };
            if (query.startDate && query.endDate) {
                whereClause.orderDate = {
                    [Op.between]: [new Date(query.startDate), new Date(query.endDate)]
                };
            }

            const items = await OrderItem.findAll({
                include: [
                    {
                        model: Order,
                        where: whereClause,
                        attributes: [] // Only include for filtering, not in result
                    },
                    {
                        model: Product,
                        attributes: ['name', 'sku', 'purchasePrice']
                    },
                    {
                        model: ProductVariant,
                        attributes: ['sku'],
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
                        required: false
                    }
                ],
                attributes: [
                    'ProductId',
                    'ProductVariantId',
                    [sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'totalQuantity'],
                    [sequelize.fn('SUM', sequelize.col('OrderItem.subtotal')), 'totalRevenue'],
                    [sequelize.fn('COUNT', sequelize.col('OrderItem.id')), 'orderCount']
                ],
                group: [
                    'OrderItem.ProductId',
                    'OrderItem.ProductVariantId',
                    'Product.id',
                    'ProductVariant.id',
                    'ProductVariant.sku',
                    'Product.name',
                    'Product.sku',
                    'Product.purchasePrice',
                    'ProductVariant->Color.id',
                    'ProductVariant->Color.name',
                    'ProductVariant->Size.id',
                    'ProductVariant->Size.name'
                ],
                order: [[sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'DESC']],
                limit: query.limit || 10
            });

            const formattedItems = items.map(item => {
                const totalQuantity = parseInt(item.dataValues.totalQuantity);
                const totalRevenue = parseFloat(item.dataValues.totalRevenue);
                const totalCost = Number(item?.Product?.purchasePrice || 0) * totalQuantity;
                const profit = totalRevenue - totalCost;

                return {
                    name: item?.Product?.name + (item?.ProductVariant ?
                        ` (${item?.ProductVariant?.Color?.name || ''} - ${item?.ProductVariant?.Size?.name || ''})` : ''),
                    sku: item?.ProductVariant ? item?.ProductVariant?.sku : item?.Product?.sku,
                    totalQuantity,
                    totalRevenue,
                    profit,
                    averagePrice: (totalRevenue / totalQuantity).toFixed(2),
                    orderCount: parseInt(item.dataValues.orderCount)
                };
            });

            return {
                status: true,
                message: "Top selling items retrieved successfully",
                data: formattedItems
            };
        } catch (error) {
            return {
                status: false,
                message: error.isClientError ? error.message : "Failed to retrieve top selling items",
                error: error.message
            };
        }
    },

    async getTopCustomers(accessibleShopIds, query = {}) {
        try {
            const targetShopIds = resolveShopFilter(accessibleShopIds, query.shopId);
            const whereClause = { UserId: { [Op.in]: targetShopIds } };
            if (query.startDate && query.endDate) {
                whereClause.orderDate = {
                    [Op.between]: [new Date(query.startDate), new Date(query.endDate)]
                };
            }

            const customers = await Order.findAll({
                where: whereClause,
                attributes: [
                    'customerName',
                    'customerPhone',
                    'customerEmail',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'totalOrders'],
                    [sequelize.fn('SUM', sequelize.col('total')), 'totalSpent']
                ],
                group: ['customerPhone'],
                order: [[sequelize.fn('SUM', sequelize.col('total')), 'DESC']],
                limit: query.limit || 10
            });

            const formattedCustomers = customers.map(customer => ({
                name: customer.customerName || 'Guest Customer',
                phone: customer.customerPhone,
                email: customer.customerEmail || 'N/A',
                totalOrders: parseInt(customer.dataValues.totalOrders),
                totalSpent: parseFloat(customer.dataValues.totalSpent),
                averageOrderValue: (customer.dataValues.totalSpent / customer.dataValues.totalOrders).toFixed(2)
            }));

            return {
                status: true,
                message: "Top customers retrieved successfully",
                data: formattedCustomers
            };
        } catch (error) {
            return {
                status: false,
                message: error.isClientError ? error.message : "Failed to retrieve top customers",
                error: error.message
            };
        }
    },

    /**
     * Comprehensive Sales & Inventory dashboard
     *
     * Supports filters:
     * - shopId (mapped via UserId / accessibleShopIds)
     * - productSearch (name / sku)
     * - variantSearch (variant sku)
     * - categoryId, brandId, modelNo, colorId, unitId
     * - startDate, endDate (start of day / end of day)
     */
    async getSalesInventoryDashboard(accessibleShopIds, query = {}) {
        try {
            const {
                shopId,
                productSearch,
                variantSearch,
                categoryId,
                brandId,
                modelNo,
                colorId,
                unitId,
                startDate,
                endDate,
            } = query;

            const targetShopIds = resolveShopFilter(accessibleShopIds, shopId);

            // --- Date range (start of day / end of day) ---
            let start = startDate ? new Date(startDate) : new Date();
            let end = endDate ? new Date(endDate) : new Date();

            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            // --- Shared where clauses ---
            const orderWhere = {
                UserId: { [Op.in]: targetShopIds },
                orderStatus: "completed",
                orderDate: {
                    [Op.between]: [start, end],
                },
            };

            const productWhere = {
                UserId: { [Op.in]: targetShopIds },
                status: "active",
            };

            if (categoryId) {
                const id = Number(categoryId);
                if (!Number.isNaN(id)) {
                    productWhere.CategoryId = id;
                }
            }

            if (brandId) {
                const id = Number(brandId);
                if (!Number.isNaN(id)) {
                    productWhere.BrandId = id;
                }
            }

            if (unitId) {
                const id = Number(unitId);
                if (!Number.isNaN(id)) {
                    productWhere.UnitId = id;
                }
            }

            if (modelNo) {
                productWhere.modelNo = modelNo;
            }

            if (productSearch) {
                productWhere[Op.or] = [
                    { name: { [Op.like]: `%${productSearch}%` } },
                    { sku: { [Op.like]: `%${productSearch}%` } },
                ];
            }

            const variantWhere = {};

            if (colorId) {
                const id = Number(colorId);
                if (!Number.isNaN(id)) {
                    variantWhere.ColorId = id;
                }
            }

            if (variantSearch) {
                variantWhere[Op.or] = [
                    { sku: { [Op.like]: `%${variantSearch}%` } },
                ];
            }

            // --- KPIs: today (or date range) sales ---
            const kpiRow = await OrderItem.findOne({
                attributes: [
                    [fn("SUM", col("OrderItem.quantity")), "itemsSold"],
                    [fn("SUM", col("OrderItem.subtotal")), "salesAmount"],
                    [
                        fn(
                            "COUNT",
                            fn("DISTINCT", col("Order.id"))
                        ),
                        "orders",
                    ],
                ],
                include: [
                    {
                        model: Order,
                        attributes: [],
                        where: orderWhere,
                    },
                    {
                        model: Product,
                        attributes: [],
                        where: productWhere,
                        required: Object.keys(productWhere).length > 0,
                    },
                    {
                        model: ProductVariant,
                        attributes: [],
                        where: Object.keys(variantWhere).length ? variantWhere : undefined,
                        required: Object.keys(variantWhere).length > 0,
                    },
                ],
                raw: true,
            });

            const todayItemsSold = Number(kpiRow?.itemsSold || 0);
            const todaySalesAmount = Number(kpiRow?.salesAmount || 0);
            const todayOrders = Number(kpiRow?.orders || 0);

            // --- Date-wise sales / order count within range ---
            const dailyAgg = await OrderItem.findAll({
                attributes: [
                    [fn("DATE", col("Order.orderDate")), "date"],
                    [fn("SUM", col("OrderItem.subtotal")), "salesAmount"],
                    [fn("SUM", col("OrderItem.quantity")), "itemsSold"],
                    [
                        fn(
                            "COUNT",
                            fn("DISTINCT", col("Order.id"))
                        ),
                        "orders",
                    ],
                ],
                include: [
                    {
                        model: Order,
                        attributes: [],
                        where: orderWhere,
                    },
                    {
                        model: Product,
                        attributes: [],
                        where: productWhere,
                    },
                    {
                        model: ProductVariant,
                        attributes: [],
                        where: Object.keys(variantWhere).length ? variantWhere : undefined,
                        required: Object.keys(variantWhere).length > 0,
                    },
                ],
                group: [fn("DATE", col("Order.orderDate"))],
                order: [[fn("DATE", col("Order.orderDate")), "ASC"]],
                raw: true,
            });

            const timeSeriesByDate = dailyAgg.map((row) => ({
                date: row.date,
                salesAmount: Number(row.salesAmount || 0),
                itemsSold: Number(row.itemsSold || 0),
                orders: Number(row.orders || 0),
            }));

            // --- Low stock & out of stock based on alertQuantity / quantity ---
            const lowStockProducts = await Product.count({
                where: {
                    ...productWhere,
                    stock: {
                        [Op.gt]: 0,
                        [Op.lte]: col("alertQuantity"),
                    },
                },
            });

            const outOfStockProducts = await Product.count({
                where: {
                    ...productWhere,
                    stock: 0,
                },
            });

            const lowStockVariants = await ProductVariant.count({
                where: {
                    ...variantWhere,
                    quantity: {
                        [Op.gt]: 0,
                        [Op.lte]: col("ProductVariant.alertQuantity"),
                    },
                },
                include: [
                    {
                        model: Product,
                        attributes: [],
                        where: productWhere,
                    },
                ],
            });

            const outOfStockVariants = await ProductVariant.count({
                where: {
                    ...variantWhere,
                    quantity: 0,
                },
                include: [
                    {
                        model: Product,
                        attributes: [],
                        where: productWhere,
                    },
                ],
            });

            // --- Product-level sales & stock ---
            const salesByProduct = await OrderItem.findAll({
                attributes: [
                    "ProductId",
                    [fn("SUM", col("OrderItem.quantity")), "salesQty"],
                    [fn("SUM", col("OrderItem.subtotal")), "salesAmount"],
                ],
                include: [
                    {
                        model: Order,
                        attributes: [],
                        where: orderWhere,
                    },
                    {
                        model: Product,
                        attributes: [],
                        where: productWhere,
                    },
                ],
                group: ["ProductId"],
                raw: true,
            });

            const stockByProduct = await Product.findAll({
                attributes: [
                    "id",
                    "name",
                    "sku",
                    "CategoryId",
                    "BrandId",
                    "modelNo",
                    "stock",
                ],
                where: productWhere,
                include: [
                    {
                        model: Category,
                        attributes: ["id", "name"],
                        required: false,
                    },
                    {
                        model: Brand,
                        attributes: ["id", "name"],
                        required: false,
                    },
                ],
                raw: true,
            });

            // Variant stock aggregated per product (for products that have variants)
            const variantStockByProduct = await ProductVariant.findAll({
                attributes: [
                    "ProductId",
                    [fn("SUM", col("quantity")), "variantStockQty"],
                ],
                include: [
                    {
                        model: Product,
                        attributes: [],
                        where: productWhere,
                    },
                ],
                where: Object.keys(variantWhere).length ? variantWhere : undefined,
                group: ["ProductId"],
                raw: true,
            });

            const salesByProductMap = salesByProduct.reduce((acc, row) => {
                acc[row.ProductId] = {
                    salesQty: Number(row.salesQty || 0),
                    salesAmount: Number(row.salesAmount || 0),
                };
                return acc;
            }, {});

            const variantStockMap = variantStockByProduct.reduce((acc, row) => {
                acc[row.ProductId] = Number(row.variantStockQty || 0);
                return acc;
            }, {});

            // --- Variant-level sales & stock ---
            const salesByVariant = await OrderItem.findAll({
                attributes: [
                    "ProductVariantId",
                    [fn("SUM", col("OrderItem.quantity")), "salesQty"],
                    [fn("SUM", col("OrderItem.subtotal")), "salesAmount"],
                ],
                include: [
                    {
                        model: Order,
                        attributes: [],
                        where: orderWhere,
                    },
                    {
                        model: ProductVariant,
                        attributes: [],
                        where: Object.keys(variantWhere).length ? variantWhere : undefined,
                    },
                    {
                        model: Product,
                        attributes: [],
                        where: productWhere,
                    },
                ],
                group: ["ProductVariantId"],
                raw: true,
            });

            const stockByVariant = await ProductVariant.findAll({
                attributes: ["id", "sku", "quantity", "ColorId", "SizeId"],
                include: [
                    {
                        model: Product,
                        attributes: ["id", "name"],
                        where: productWhere,
                    },
                    {
                        model: Color,
                        attributes: ["name"],
                        required: false,
                    },
                    {
                        model: Size,
                        attributes: ["name"],
                        required: false,
                    },
                ],
            });

            const salesByVariantMap = salesByVariant.reduce((acc, row) => {
                acc[row.ProductVariantId] = {
                    salesQty: Number(row.salesQty || 0),
                    salesAmount: Number(row.salesAmount || 0),
                };
                return acc;
            }, {});

            const variantRows = stockByVariant.map((v) => {
                const sales = salesByVariantMap[v.id] || {
                    salesQty: 0,
                    salesAmount: 0,
                };

                let stockStatus = "HEALTHY";
                const alertQty = Number(v.alertQuantity || 0);
                const qty = Number(v.quantity || 0);

                if (qty === 0) {
                    stockStatus = "OUT";
                } else if (alertQty && qty <= alertQty) {
                    stockStatus = "LOW";
                }

                return {
                    variantId: v.id,
                    sku: v.sku,
                    productId: v.Product?.id,
                    productName: v.Product?.name,
                    colorName: v.Color?.name || null,
                    sizeName: v.Size?.name || null,
                    stockQty: qty,
                    salesQty: sales.salesQty,
                    salesAmount: sales.salesAmount,
                    stockStatus,
                };
            });

            // Index variants by productId for embedding into product view
            const variantsByProductId = variantRows.reduce((acc, v) => {
                if (!v.productId) return acc;
                if (!acc[v.productId]) acc[v.productId] = [];
                acc[v.productId].push(v);
                return acc;
            }, {});

            // Build normalized product rows, embedding variants
            const productRows = stockByProduct.map((p) => {
                const categoryId = p.CategoryId || p["Category.id"] || null;
                const brandId = p.BrandId || p["Brand.id"] || null;
                const categoryName = p["Category.name"] || null;
                const brandName = p["Brand.name"] || null;

                // If product has variants (in current filter), use variant stock as the source of truth.
                // Otherwise, fall back to parent product stock.
                const variantStockQty = variantStockMap[p.id];
                const effectiveStock =
                    typeof variantStockQty === "number" && !Number.isNaN(variantStockQty)
                        ? variantStockQty
                        : Number(p.stock || 0);

                const sales = salesByProductMap[p.id] || {
                    salesQty: 0,
                    salesAmount: 0,
                };

                const variants = variantsByProductId[p.id] || [];

                return {
                    productId: p.id,
                    name: p.name,
                    sku: p.sku,
                    categoryId,
                    categoryName,
                    brandId,
                    brandName,
                    modelNo: p.modelNo,
                    stockQty: effectiveStock,
                    salesQty: sales.salesQty,
                    salesAmount: sales.salesAmount,
                    hasVariants: variants.length > 0,
                    variants,
                };
            });

            // Total stock now based on effective per-product stock
            const totalCurrentStock = productRows.reduce(
                (sum, p) => sum + Number(p.stockQty || 0),
                0
            );

            // Aggregate views: category-wise, brand-wise, model-wise
            const categoryViewMap = {};
            const brandViewMap = {};
            const modelViewMap = {};

            productRows.forEach((p) => {
                // Category-wise
                if (p.categoryId) {
                    if (!categoryViewMap[p.categoryId]) {
                        categoryViewMap[p.categoryId] = {
                            categoryId: p.categoryId,
                            categoryName: p.categoryName || null,
                            productsCount: 0,
                            stockQty: 0,
                            salesQty: 0,
                            salesAmount: 0,
                        };
                    }
                    const c = categoryViewMap[p.categoryId];
                    c.productsCount += 1;
                    c.stockQty += Number(p.stockQty || 0);
                    c.salesQty += Number(p.salesQty || 0);
                    c.salesAmount += Number(p.salesAmount || 0);
                }

                // Brand-wise
                if (p.brandId) {
                    if (!brandViewMap[p.brandId]) {
                        brandViewMap[p.brandId] = {
                            brandId: p.brandId,
                            brandName: p.brandName || null,
                            productsCount: 0,
                            stockQty: 0,
                            salesQty: 0,
                            salesAmount: 0,
                        };
                    }
                    const b = brandViewMap[p.brandId];
                    b.productsCount += 1;
                    b.stockQty += Number(p.stockQty || 0);
                    b.salesQty += Number(p.salesQty || 0);
                    b.salesAmount += Number(p.salesAmount || 0);
                }

                // Model-wise
                if (p.modelNo) {
                    if (!modelViewMap[p.modelNo]) {
                        modelViewMap[p.modelNo] = {
                            modelNo: p.modelNo,
                            productsCount: 0,
                            stockQty: 0,
                            salesQty: 0,
                            salesAmount: 0,
                        };
                    }
                    const m = modelViewMap[p.modelNo];
                    m.productsCount += 1;
                    m.stockQty += Number(p.stockQty || 0);
                    m.salesQty += Number(p.salesQty || 0);
                    m.salesAmount += Number(p.salesAmount || 0);
                }
            });

            const productTotal = productRows.length;
            const variantTotal = variantRows.length;

            return {
                status: true,
                message: "Sales & inventory dashboard generated successfully",
                data: {
                    filtersUsed: {
                        shopId,
                        startDate: start,
                        endDate: end,
                        productSearch: productSearch || null,
                        variantSearch: variantSearch || null,
                        categoryId: categoryId || null,
                        brandId: brandId || null,
                        modelNo: modelNo || null,
                        colorId: colorId || null,
                        unitId: unitId || null,
                    },
                    kpis: {
                        todaySalesAmount,
                        todayItemsSold,
                        todayOrders,
                        currentStock: totalCurrentStock,
                        lowStockCount: lowStockProducts + lowStockVariants,
                        outOfStockCount: outOfStockProducts + outOfStockVariants,
                        totalProducts: productTotal,
                        totalCategories: Object.keys(categoryViewMap).length,
                        totalBrands: Object.keys(brandViewMap).length,
                    },
                    productView: {
                        total: productTotal,
                        rows: productRows,
                    },
                    variantView: {
                        total: variantTotal,
                        rows: variantRows,
                    },
                    timeSeries: {
                        byDate: timeSeriesByDate,
                    },
                    categoryView: {
                        totalCategories: Object.keys(categoryViewMap).length,
                        rows: Object.values(categoryViewMap),
                    },
                    brandView: {
                        totalBrands: Object.keys(brandViewMap).length,
                        rows: Object.values(brandViewMap),
                    },
                    modelView: {
                        totalModels: Object.keys(modelViewMap).length,
                        rows: Object.values(modelViewMap),
                    },
                },
            };
        } catch (error) {
            console.error("getSalesInventoryDashboard error:", error);
            return {
                status: false,
                message: error.isClientError
                    ? error.message
                    : "Failed to generate sales & inventory dashboard",
                error: error.message,
            };
        }
    },

    async validateOrderItems(items, transaction, accessibleShopIds) {
        const validatedItems = [];
        let subtotal = 0;

        console.log({ items })

        for (const item of items) {
            const { productId, variantId, quantity, unitPrice, discountAmount, discountType } = item;

            // Validate product exists and belongs to user
            const product = await Product.findOne({
                where: {
                    id: productId,
                    UserId: { [Op.in]: accessibleShopIds },
                    status: "active"
                },
                transaction
            });

            if (!product) {
                throw new Error(`Product with ID ${productId} not found or unauthorized`);
            }

            let finalPrice;
            let currentStock;
            let variant = null;

            if (variantId) {
                // Validate variant exists and belongs to the product
                variant = await ProductVariant.findOne({
                    where: {
                        id: variantId,
                        ProductId: productId
                    },
                    transaction
                });

                if (!variant) {
                    throw new Error(`Variant with ID ${variantId} not found for product ${productId}`);
                }

                currentStock = variant.quantity;
                // Use product price for variant as they share the same price
                finalPrice = unitPrice;
                // finalPrice = product.salesPrice;
            } else {
                currentStock = product.stock;
                finalPrice = unitPrice;
            }

            // Check stock availability
            if (currentStock < quantity) {

                const orderItemData = item?.orderItemId ? await OrderItem.findOne({ where: { id: item?.orderItemId } }) : null;

                if (!orderItemData || Number(orderItemData.quantity) < Number(quantity))
                    throw new Error(`Insufficient stock for ${variant ? 'variant' : 'product'} ${variant ? variantId : productId}`);
            }

            // Calculate item subtotal with any applicable discounts
            let itemPrice = finalPrice;


            if (discountType && discountAmount) {
                if (discountType === 'percentage') {
                    itemPrice = finalPrice * (1 - discountAmount / 100);

                } else if (discountType === 'amount') {
                    itemPrice = finalPrice - discountAmount;
                }
            }

            const discountPrice = finalPrice - itemPrice;

            itemPrice = itemPrice + itemPrice * (product.vat / 100)

            const itemSubtotal = itemPrice * quantity;
            subtotal += itemSubtotal;

            validatedItems.push({
                orderItemId: item.orderItemId,
                productId,
                variantId,
                quantity,
                unitPrice: itemPrice,
                discountAmount: discountAmount,
                discountType: discountType,
                subtotal: itemSubtotal,
                discount: discountPrice,
                currentStock,
                product,
                variant
            });
        }

        return { validatedItems, subtotal };
    },

    async getSalesChartData(accessibleShopIds, query = {}) {
        try {
            const { startDate, endDate } = query;
            const targetShopIds = resolveShopFilter(accessibleShopIds, query.shopId);

            if (!startDate || !endDate) {
                throw new Error("Start date and end date are required");
            }

            const whereClause = {
                UserId: { [Op.in]: targetShopIds },
                orderStatus: 'completed',
                orderDate: {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                }
            };

            // Calculate date difference to determine report type
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            // If date range is within one month, show daily report
            const type = diffDays <= 31 ? 'daily' : 'monthly';
            const groupByFormat = type === 'daily'
                ? 'DATE(orderDate)'
                : "DATE_FORMAT(orderDate, '%Y-%m')";

            const salesData = await Order.findAll({
                where: whereClause,
                attributes: [
                    [sequelize.literal(groupByFormat), 'date'],
                    [sequelize.fn('SUM', sequelize.col('total')), 'sales'],
                    [sequelize.fn('SUM', sequelize.col('discount')), 'discounts'],
                    [sequelize.fn('COUNT', sequelize.col('Order.id')), 'orderCount'],
                    [sequelize.fn('SUM', sequelize.col('tax')), 'tax']
                ],
                group: [sequelize.literal(groupByFormat)],
                order: [sequelize.literal('date ASC')]
            });





            // Format the data
            const formattedData = salesData.map(item => {
                const date = new Date(item.getDataValue('date'));
                const name = type === 'daily'
                    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                return {
                    name,
                    date: item.getDataValue('date'),
                    sales: Number(item.getDataValue('sales')),
                    discounts: Number(item.getDataValue('discounts')),
                    orderCount: Number(item.getDataValue('orderCount')),
                    tax: Number(item.getDataValue('tax')),
                    averageOrderValue: Number(
                        (item.getDataValue('sales') / item.getDataValue('orderCount')).toFixed(2)
                    )
                };
            });



            // Calculate summary
            const summary = formattedData.reduce((acc, curr) => {
                acc.totalSales += curr.sales;
                acc.totalDiscounts += curr.discounts;
                acc.totalOrders += curr.orderCount;
                acc.totalTax += curr.tax;
                return acc;
            }, {
                totalSales: 0,
                totalDiscounts: 0,
                totalOrders: 0,
                totalTax: 0
            });

            summary.averageOrderValue = Number(
                (summary.totalSales / summary.totalOrders).toFixed(2)
            );

            return {
                status: true,
                message: `Sales report generated successfully`,
                data: {
                    chartData: formattedData,
                    summary,
                    period: type,
                    startDate,
                    endDate,
                    totalDays: diffDays
                }
            };

        } catch (error) {
            console.error(error);
            return {
                status: false,
                message: error.isClientError ? error.message : "Failed to generate sales chart data",
                error: error.message
            };
        }
    },

    // Generate sequential 8-digit order number (max 99,999,999 orders)
    async generateOrderNumber(shopId, transaction) {
        // Find the latest order by order number
        const latestOrder = await Order.findOne({
            where: {
                orderNumber: {
                    [Op.regexp]: '^[0-9]+$' // Only numeric order numbers
                }
            },
            order: [['orderNumber', 'DESC']],
            transaction
        });

        let nextId = 1;
        if (latestOrder && latestOrder.orderNumber) {
            const currentId = parseInt(latestOrder.orderNumber);
            if (!isNaN(currentId)) {
                nextId = currentId + 1;
            }
        }

        if (nextId > 99999999) {
            throw new Error('Order number limit (99,999,999) reached. Please contact support.');
        }

        return String(nextId).padStart(8, '0');
    }
};

module.exports = OrderService;
