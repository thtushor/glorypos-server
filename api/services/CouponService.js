const { Coupon, UserSubscription } = require('../entity');
const { Op, Sequelize } = require('sequelize');

const CouponService = {
    async createCoupon(couponData) {
        try {
            const coupon = await Coupon.create(couponData);
            return {
                status: true,
                message: "Coupon created successfully",
                data: coupon
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to create coupon",
                error: error.message
            };
        }
    },

    async getAllCoupons(query = {}) {
        try {
            const whereClause = {};
            if (query.status) whereClause.status = query.status;

            const coupons = await Coupon.findAll({
                where: whereClause,
                order: [['createdAt', 'DESC']]
            });

            return {
                status: true,
                message: "Coupons retrieved successfully",
                data: coupons
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to retrieve coupons",
                error: error.message
            };
        }
    },

    async validateCoupon(code, amount) {
        try {
            const coupon = await Coupon.findOne({
                where: {
                    code: code,
                    status: 'active',
                    startDate: {
                        [Op.lte]: new Date()
                    },
                    endDate: {
                        [Op.gte]: new Date()
                    },
                    usedCount: {
                        [Op.lt]: Sequelize.col('maxUses')
                    }
                }
            });

            if (!coupon) {
                return {
                    status: false,
                    message: "Invalid or expired coupon",
                    data: null
                };
            }

            // Check minimum purchase amount
            if (Number(coupon.minPurchaseAmount) && Number(amount) < Number(coupon.minPurchaseAmount)) {
                return {
                    status: false,
                    message: `Minimum purchase amount of ${coupon.minPurchaseAmount} required`,
                    data: null
                };
            }

            // Calculate discount
            let discountAmount;
            if (coupon.type === 'percentage') {
                discountAmount = (amount * coupon.value) / 100;
                if (coupon.maxDiscountAmount) {
                    discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
                }
            } else {
                discountAmount = coupon.value;
            }

            return {
                status: true,
                message: "Coupon is valid",
                data: {
                    coupon,
                    discountAmount
                }
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to validate coupon",
                error: error.message
            };
        }
    },

    async updateCoupon(id, updateData) {
        try {
            const coupon = await Coupon.findByPk(id);
            if (!coupon) {
                return {
                    status: false,
                    message: "Coupon not found",
                    data: null
                };
            }

            await coupon.update(updateData);
            return {
                status: true,
                message: "Coupon updated successfully",
                data: coupon
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to update coupon",
                error: error.message
            };
        }
    },

    async deleteCoupon(id) {
        try {
            const coupon = await Coupon.findByPk(id);
            if (!coupon) {
                return {
                    status: false,
                    message: "Coupon not found",
                    data: null
                };
            }

            await coupon.destroy();
            return {
                status: true,
                message: "Coupon deleted successfully",
                data: null
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to delete coupon",
                error: error.message
            };
        }
    }
};

module.exports = CouponService; 