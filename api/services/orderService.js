const { Order, OrderItem, Product, ProductVariant, StockHistory, Color, Size, User, StuffCommission, UserRole } = require('../entity');
const sequelize = require('../db');
const { Op } = require('sequelize');
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

            console.log({ validatedItems, subtotal })

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

            // Generate unique order number
            const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // Create order
            const order = await Order.create({
                ...orderData,
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
                paymentStatus
            }, { transaction });

            // Process order items and update stock
            for (const item of validatedItems) {
                const {
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

                console.log({ unitPrice, orderPrice: orderData?.unitPrice, productPrice: product.price })

                // Create order item
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
                    purchasePrice: Number(product?.purchasePrice || 0),
                }, { transaction });

                // Update stock
                const newStock = currentStock - quantity;

                if (variantId && variant) {
                    await variant.update({ quantity: newStock }, { transaction });
                    await StockHistory.create({
                        type: 'order',
                        quantity,
                        previousStock: currentStock,
                        newStock,
                        ProductId: productId,
                        ProductVariantId: variantId,
                        OrderId: order.id,
                        UserId: userId,
                        note: `Order ${orderNumber}`
                    }, { transaction });
                } else {
                    await product.update({ stock: newStock }, { transaction });
                    await StockHistory.create({
                        type: 'order',
                        quantity,
                        previousStock: currentStock,
                        newStock,
                        ProductId: productId,
                        OrderId: order.id,
                        UserId: userId,
                        note: `Order ${orderNumber}`
                    }, { transaction });
                }
            }

            // Create commission if stuffId is provided
            if (orderData?.stuffId && orderData.stuffId.toString().trim() !== '') {
                try {
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
                error: error.message
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
        try {
            const order = await Order.findByPk(orderId, { include: [{ model: OrderItem, as: 'items' }] });
            if (!order) {
                return { status: false, message: 'Order not found', data: null };
            }
            return { status: true, message: 'Order retrieved successfully', data: order };
        } catch (error) {
            return { status: false, message: 'Failed to retrieve order', error };
        }
    },

    async delete(orderId) {
        try {
            const order = await Order.findByPk(orderId);
            if (!order) {
                return { status: false, message: 'Order not found' };
            }
            await order.destroy();
            return { status: true, message: 'Order deleted successfully' };
        } catch (error) {
            return { status: false, message: 'Failed to delete order', error };
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

            // if (dateRange?.startDate && dateRange?.endDate) {
            //     whereClause.orderDate = {
            //         [Op.between]: [dateRange.startDate, dateRange.endDate]
            //     };
            // }

            if (dateRange?.startDate && dateRange?.endDate) {
                const start = new Date(dateRange.startDate);
                start.setHours(0, 0, 0, 0); // start of day

                const end = new Date(dateRange.endDate);
                end.setHours(23, 59, 59, 999); // end of day

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
                            attributes: ['purchasePrice']
                        }
                    ]
                }]
            });

            // Get total commissions with same filters
            const commissionWhereClause = {
                UserId: { [Op.in]: targetShopIds }
            };

            // Apply date range filter to commissions if provided
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
                UserId: { [Op.in]: targetShopIds },
                status: 'active'
            };

            const totalProducts = await Product.count({
                where: productWhereClause
            }) || 0;

            // Calculate detailed statistics
            const stats = orders.reduce((acc, order) => {
                acc.totalSales += Number(order.total);
                acc.totalOrders++;
                acc.totalDiscount += Number(order.discount);
                acc.totalTax += Number(order.tax);

                // Calculate profit/loss per item
                order.OrderItems.forEach(item => {
                    const costPrice = Number(item?.purchasePrice || item.Product.purchasePrice || 0);
                    const revenue = Number(item.unitPrice * item.quantity);
                    const cost = Number(costPrice * item.quantity);
                    const itemProfit = Number(revenue - cost);

                    if (itemProfit >= 0) {
                        acc.totalProfit += Number(itemProfit);
                    } else {
                        acc.totalLoss += Number(Math.abs(itemProfit));
                    }
                });

                return acc;
            }, {
                totalSales: 0,
                totalOrders: 0,
                totalProfit: 0,
                totalLoss: 0,
                totalDiscount: 0,
                totalTax: 0,
                totalCommissions: Number(totalCommissions),
                totalProducts: Number(totalProducts)
            });

            return {
                status: true,
                message: "Dashboard statistics retrieved successfully",
                data: stats
            };
        } catch (error) {
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
                orderNumber: order.orderNumber,
                date: order.orderDate,
                orderStatus: order.orderStatus,

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
                    accountType: userData?.accountType
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
                        if (colorName || sizeName) {
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
                            color: colorName,
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
                        if (colorName || sizeName) {
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
                        color: colorName,
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
                const totalCost = item.Product.purchasePrice * totalQuantity;
                const profit = totalRevenue - totalCost;

                return {
                    name: item.Product.name + (item.ProductVariant ?
                        ` (${item.ProductVariant.Color?.name || ''} - ${item.ProductVariant.Size?.name || ''})` : ''),
                    sku: item.ProductVariant ? item.ProductVariant.sku : item.Product.sku,
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
            console.log({ error });
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

            console.log({ validatedItems })
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
    }
};

module.exports = OrderService;
