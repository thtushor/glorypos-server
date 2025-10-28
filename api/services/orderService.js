const { Order, OrderItem, Product, ProductVariant, StockHistory, Color, Size, User } = require('../entity');
const sequelize = require('../db');
const { Op } = require('sequelize');

// Service
const OrderService = {
    async create(orderData, userId) {
        const transaction = await sequelize.transaction();
        try {
            // Validate and calculate prices for all items
            const { validatedItems, subtotal } = await this.validateOrderItems(orderData?.items, userId, transaction);

            // Calculate tax and total
            const tax = orderData?.tax || 0;
            const discount = orderData?.discount || 0;
            const total = subtotal + tax;

            // Generate unique order number
            const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // Create order
            const order = await Order.create({
                ...orderData,
                orderNumber,
                UserId: { [Op.in]: accessibleShopIds },
                orderDate: new Date(),
                subtotal,
                tax,
                discount,
                total
            }, { transaction });

            // Process order items and update stock
            for (const item of validatedItems) {
                const {
                    productId,
                    variantId,
                    quantity,
                    unitPrice,
                    subtotal,
                    currentStock,
                    variant,
                    product
                } = item;

                // Create order item
                await OrderItem.create({
                    OrderId: order.id,
                    ProductId: productId,
                    ProductVariantId: variantId,
                    quantity,
                    unitPrice: orderData?.unitPrice || unitPrice,
                    subtotal,
                    purchasePrice: Number(product?.purchasePrice || 0)
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
                        UserId: { [Op.in]: accessibleShopIds },
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
                        UserId: { [Op.in]: accessibleShopIds },
                        note: `Order ${orderNumber}`
                    }, { transaction });
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
            const whereClause = { UserId: { [Op.in]: accessibleShopIds } };

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
                }],
                order: [['orderDate', 'DESC']],
                limit: pageSize,
                offset: offset
            });

            return {
                status: true,
                message: "Orders retrieved successfully",
                data: {
                    orders,
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
                message: "Failed to retrieve orders",
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

    async getDashboardStats(accessibleShopIds, dateRange) {
        try {
            const whereClause = {
                UserId: { [Op.in]: accessibleShopIds },
                orderStatus: 'completed'
            };

            if (dateRange?.startDate && dateRange?.endDate) {
                whereClause.orderDate = {
                    [Op.between]: [dateRange.startDate, dateRange.endDate]
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
                totalTax: 0
            });

            return {
                status: true,
                message: "Dashboard statistics retrieved successfully",
                data: stats
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to retrieve dashboard statistics",
                error: error.message
            };
        }
    },

    async getSalesReport(accessibleShopIds, query = {}) {
        try {
            const whereClause = { UserId: { [Op.in]: accessibleShopIds } };
            if (query.startDate && query.endDate) {
                whereClause.orderDate = {
                    [Op.between]: [new Date(query.startDate), new Date(query.endDate)]
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
                message: "Failed to generate sales report",
                error: error.message
            };
        }
    },

    async generateInvoice(orderId, accessibleShopIds) {
        try {


            const userData = await User.findByPk(userId);


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

            // Format invoice data
            const invoiceData = {
                invoiceNumber: `INV-${order.orderNumber}`,
                date: order.orderDate,
                customer: {
                    name: order.customerName || 'Guest Customer',
                    phone: order.customerPhone || 'N/A',
                    email: order.customerEmail || 'N/A'
                },
                items: order.OrderItems.map(item => {
                    let productName, sku, details;

                    if (item.ProductVariant) {
                        productName = item.ProductVariant?.Product?.name || "";
                        sku = item?.ProductVariant?.sku;
                        details = `${item?.ProductVariant?.Color?.name} - ${item?.ProductVariant?.Size?.name}`;
                    }
                    else if (item.Product) {
                        productName = item?.Product?.name;
                        sku = item?.Product?.sku;
                        details = `${item?.Product?.Color?.name || ""} - ${item?.Product?.Size?.name || ""}`;
                    }

                    return {
                        productName,
                        sku,
                        details,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        subtotal: item.subtotal
                    };
                }),
                summary: {
                    subtotal: order.subtotal,
                    tax: order.tax,
                    taxRate: (order.tax / order.subtotal * 100).toFixed(2) + '%',
                    discount: order.discount,
                    discountRate: order.discount > 0 ?
                        (order.discount / order.subtotal * 100).toFixed(2) + '%' : '0%',
                    total: order.total
                },
                payment: {
                    method: order.paymentMethod,
                    status: order.paymentStatus
                },
                orderStatus: order.orderStatus,
                businessInfo: {
                    name: userData?.businessName || "FG-POS", // You might want to make this configurable
                    address: userData?.location || "162/26 NaNai Road, PaTong, Kathu, Phuket- 83150, Thailand.",
                    phone: userData?.phoneNumber || "+66910414319",
                    email: userData?.email || "support@fashiongloryltd.com",
                    website: userData?.email || "https://fashion-glory-pos-system.vercel.app",
                    taxId: "123456"
                }
            };

            // Calculate additional statistics
            const stats = {
                totalItems: order.OrderItems.reduce((sum, item) => sum + item.quantity, 0),
                totalUniqueItems: order.OrderItems.length,
                averageItemPrice: (order.subtotal /
                    order.OrderItems.reduce((sum, item) => sum + item.quantity, 0)).toFixed(2)
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
            const whereClause = { UserId: { [Op.in]: accessibleShopIds } };
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
                message: "Failed to retrieve top selling items",
                error: error.message
            };
        }
    },

    async getTopCustomers(accessibleShopIds, query = {}) {
        try {
            const whereClause = { UserId: { [Op.in]: accessibleShopIds } };
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
                message: "Failed to retrieve top customers",
                error: error.message
            };
        }
    },

    async validateOrderItems(items, userId, transaction) {
        const validatedItems = [];
        let subtotal = 0;

        for (const item of items) {
            const { productId, variantId, quantity } = item;

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
                finalPrice = product.salesPrice;
            } else {
                currentStock = product.stock;
                finalPrice = product.salesPrice;
            }

            // Check stock availability
            if (currentStock < quantity) {
                throw new Error(`Insufficient stock for ${variant ? 'variant' : 'product'} ${variant ? variantId : productId}`);
            }

            // Calculate item subtotal with any applicable discounts
            let itemPrice = finalPrice;


            if (product.discountType && product.discountAmount) {
                if (product.discountType === 'percentage') {
                    itemPrice = finalPrice * (1 - product.discountAmount / 100);

                } else if (product.discountType === 'amount') {
                    itemPrice = finalPrice - product.discountAmount;
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

            if (!startDate || !endDate) {
                throw new Error("Start date and end date are required");
            }

            const whereClause = {
                UserId: { [Op.in]: accessibleShopIds },
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
                message: "Failed to generate sales chart data",
                error: error.message
            };
        }
    }
};

module.exports = OrderService;
