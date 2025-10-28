const { UserSubscription, SubscriptionPlan, User, Product, UserRole } = require('../entity');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { parseStorageSize, calculateUserStorage } = require('../utils/helper');

const subscriptionLimits = {
    async checkSubscriptionStatus(req, res, next) {
        try {
            const activeSubscription = await UserSubscription.findOne({
                where: {
                    UserId: req.user.id,
                    status: 'active',
                    endDate: {
                        [Op.gt]: new Date()
                    },
                    paymentStatus: 'completed'
                },
                include: [{
                    model: SubscriptionPlan
                }]
            });

            if (req?.user?.accountType !== "super admin" && !activeSubscription) {
                return res.status(403).json({
                    status: false,
                    message: "No active subscription found. Please subscribe to continue."
                });
            }

            // Add subscription info to request for other middleware
            req.subscription = activeSubscription;
            next();
        } catch (error) {
            res.status(500).json({
                status: false,
                message: "Error checking subscription status",
                error: error.message
            });
        }
    },

    async checkProductLimit(req, res, next) {
        try {
            const productCount = await Product.count({
                where: { UserId: req.user.id }
            });

            if (productCount >= req.subscription.SubscriptionPlan.maxProducts) {
                return res.status(403).json({
                    status: false,
                    message: "Product limit reached for your subscription plan"
                });
            }
            next();
        } catch (error) {
            res.status(500).json({
                status: false,
                message: "Error checking product limit",
                error: error.message
            });
        }
    },

    async checkStorageLimit(req, res, next) {
        try {
            if (!req.file) return next();

            const maxStorage = parseStorageSize(req.subscription.SubscriptionPlan.maxStorage);
            const currentStorage = await calculateUserStorage(req.user.id);
            const fileSize = req.file.size;

            if (currentStorage + fileSize > maxStorage) {
                // Delete the uploaded file
                fs.unlinkSync(req.file.path);
                return res.status(403).json({
                    status: false,
                    message: "Storage limit exceeded for your subscription plan"
                });
            }
            next();
        } catch (error) {
            res.status(500).json({
                status: false,
                message: "Error checking storage limit",
                error: error.message
            });
        }
    },

    async checkUserLimit(req, res, next) {
        try {
            const userCount = await UserRole.count({
                where: {
                    parentUserId: req.user.id,
                    role: {
                        [Op.in]: ['manager', 'employee']
                    }
                }
            });

            if (req.user.accountType !== "super admin" && userCount >= req.subscription.SubscriptionPlan.maxUsers) {
                return res.status(403).json({
                    status: false,
                    message: "User limit reached for your subscription plan"
                });
            }
            next();
        } catch (error) {
            res.status(500).json({
                status: false,
                message: "Error checking user limit",
                error: error.message
            });
        }
    }
};



module.exports = subscriptionLimits; 