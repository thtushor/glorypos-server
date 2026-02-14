const {
    Notification,
    User
} = require('../entity');
const { Op } = require('sequelize');

const NotificationService = {
    /**
     * Create a new notification
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async createNotification({ shopId, title, message, type, link, referenceId, referenceType }) {
        try {
            if (!shopId || !title || !message || !type) {
                throw new Error("Missing required fields: shopId, title, message, type");
            }

            const notification = await Notification.create({
                shop_id: shopId,
                title,
                message,
                type,
                link,
                reference_id: referenceId,
                reference_type: referenceType
            });

            return {
                status: true,
                message: "Notification created successfully",
                data: notification
            };
        } catch (error) {
            console.error("Create Notification Error:", error);
            return {
                status: false,
                message: "Failed to create notification",
                error: error.message
            };
        }
    },

    /**
     * Get notifications with pagination and filtering
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async getNotifications({ shopId, isRead, type, page = 1, limit = 10 }) {
        try {
            const offset = (page - 1) * limit;
            const whereClause = {
                shop_id: shopId
            };

            if (isRead !== undefined) {
                whereClause.is_read = isRead === 'true' || isRead === true;
            }

            if (type) {
                whereClause.type = type;
            }

            const { count, rows } = await Notification.findAndCountAll({
                where: whereClause,
                order: [['createdAt', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            return {
                status: true,
                message: "Notifications retrieved successfully",
                data: {
                    notifications: rows,
                    pagination: {
                        totalItems: count,
                        totalPages: Math.ceil(count / limit),
                        currentPage: parseInt(page),
                        itemsPerPage: parseInt(limit)
                    }
                }
            };
        } catch (error) {
            console.error("Get Notifications Error:", error);
            return {
                status: false,
                message: "Failed to retrieve notifications",
                error: error.message
            };
        }
    },

    /**
     * Mark a notification as read
     * @param {number} notificationId
     * @param {number} shopId
     * @returns {Promise<Object>}
     */
    async markAsRead(notificationId, shopId) {
        try {
            const notification = await Notification.findOne({
                where: {
                    id: notificationId,
                    shop_id: shopId
                }
            });

            if (!notification) {
                return {
                    status: false,
                    message: "Notification not found"
                };
            }

            await notification.update({ is_read: true });

            return {
                status: true,
                message: "Notification marked as read",
                data: notification
            };
        } catch (error) {
            console.error("Mark As Read Error:", error);
            return {
                status: false,
                message: "Failed to mark notification as read",
                error: error.message
            };
        }
    },

    /**
     * Mark a notification as unread
     * @param {number} notificationId
     * @param {number} shopId
     * @returns {Promise<Object>}
     */
    async markAsUnread(notificationId, shopId) {
        try {
            const notification = await Notification.findOne({
                where: {
                    id: notificationId,
                    shop_id: shopId
                }
            });

            if (!notification) {
                return {
                    status: false,
                    message: "Notification not found"
                };
            }

            await notification.update({ is_read: false });

            return {
                status: true,
                message: "Notification marked as unread",
                data: notification
            };
        } catch (error) {
            console.error("Mark As Unread Error:", error);
            return {
                status: false,
                message: "Failed to mark notification as unread",
                error: error.message
            };
        }
    },

    /**
     * Mark all notifications as read
     * @param {number} shopId
     * @returns {Promise<Object>}
     */
    async markAllAsRead(shopId) {
        try {
            await Notification.update(
                { is_read: true },
                {
                    where: {
                        shop_id: shopId,
                        is_read: false
                    }
                }
            );

            return {
                status: true,
                message: "All notifications marked as read"
            };
        } catch (error) {
            console.error("Mark All As Read Error:", error);
            return {
                status: false,
                message: "Failed to mark all as read",
                error: error.message
            };
        }
    },

    /**
     * Delete a notification
     * @param {number} notificationId
     * @param {number} shopId
     * @returns {Promise<Object>}
     */
    async deleteNotification(notificationId, shopId) {
        try {
            const deletedCount = await Notification.destroy({
                where: {
                    id: notificationId,
                    shop_id: shopId
                }
            });

            if (deletedCount === 0) {
                return {
                    status: false,
                    message: "Notification not found or access denied"
                };
            }

            return {
                status: true,
                message: "Notification deleted successfully"
            };
        } catch (error) {
            console.error("Delete Notification Error:", error);
            return {
                status: false,
                message: "Failed to delete notification",
                error: error.message
            };
        }
    },

    /**
     * Get unread notification count
     * @param {number} shopId
     * @returns {Promise<Object>}
     */
    async getUnreadCount(shopId) {
        try {
            const count = await Notification.count({
                where: {
                    shop_id: shopId,
                    is_read: false
                }
            });

            return {
                status: true,
                message: "Unread count retrieved successfully",
                data: { count }
            };
        } catch (error) {
            console.error("Get Unread Count Error:", error);
            return {
                status: false,
                message: "Failed to get unread count",
                error: error.message
            };
        }
    },

    /**
     * Check if a specific notification similar to the parameters already exists and is unread.
     * Useful to prevent duplicate stock alerts.
     */
    async findUnreadStockAlert(shopId, productId, type) {
        try {
            return await Notification.findOne({
                where: {
                    shop_id: shopId,
                    type: type,
                    reference_id: productId.toString(),
                    reference_type: 'product',
                    is_read: false
                }
            });
        } catch (error) {
            console.error("Check duplicate alert error", error);
            return null;
        }
    }
};

module.exports = NotificationService;