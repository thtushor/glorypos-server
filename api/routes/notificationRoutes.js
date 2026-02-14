const express = require('express');
const { NotificationService } = require('../services');
const { AuthService } = require('../services');
const requestHandler = require('../utils/requestHandler');

const router = express.Router();

/**
 * GET /notifications
 * Query params:
 * t: type (ORDER_CREATED, STOCK_LOW, STOCK_OUT)
 * is_read: boolean
 * page: number
 * limit: number
 */
router.get('/', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const { is_read, type, page, limit } = req.query;
    const shopId = req.user.id;

    // Convert is_read string to boolean if necessary
    const isReadParam = is_read;

    const result = await NotificationService.getNotifications({
        shopId,
        isRead: isReadParam,
        type,
        page,
        limit
    });

    if (result.status) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
}));

/**
 * GET /notifications/unread-count
 */
router.get('/unread-count', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const shopId = req.user.id;
    const result = await NotificationService.getUnreadCount(shopId);

    if (result.status) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
}));

/**
 * PATCH /notifications/:id/read
 * Mark as read
 */
router.patch('/:id/read', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const shopId = req.user.id;
    const notificationId = req.params.id;

    const result = await NotificationService.markAsRead(notificationId, shopId);

    if (result.status) {
        return res.status(200).json(result);
    } else {
        return res.status(404).json(result);
    }
}));

/**
 * PATCH /notifications/:id/unread
 * Mark as unread
 */
router.patch('/:id/unread', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const shopId = req.user.id;
    const notificationId = req.params.id;

    const result = await NotificationService.markAsUnread(notificationId, shopId);

    if (result.status) {
        return res.status(200).json(result);
    } else {
        return res.status(404).json(result);
    }
}));

/**
 * PATCH /notifications/mark-all-read
 * Mark all as read
 */
router.patch('/mark-all-read', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const shopId = req.user.id;

    const result = await NotificationService.markAllAsRead(shopId); // Assuming markAllAsRead is implemented in Service

    if (result.status) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
}));


/**
 * DELETE /notifications/:id
 * Delete a notification
 */
router.delete('/:id', AuthService.authenticate, requestHandler(null, async (req, res) => {
    const shopId = req.user.id;
    const notificationId = req.params.id;

    const result = await NotificationService.deleteNotification(notificationId, shopId);

    if (result.status) {
        return res.status(200).json(result);
    } else {
        return res.status(404).json(result);
    }
}));

module.exports = router;