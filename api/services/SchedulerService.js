const cron = require('node-cron');
const { UserSubscription, User, SubscriptionPlan } = require('../entity');
const { Op } = require('sequelize');
const EmailService = require('./EmailService');

const SchedulerService = {
    // Check and update expired subscriptions - runs every day at midnight
    checkExpiredSubscriptions: cron.schedule('0 0 * * *', async () => {
        try {
            // Find and update expired subscriptions
            const expiredSubscriptions = await UserSubscription.update(
                { status: 'expired' },
                {
                    where: {
                        status: 'active',
                        endDate: {
                            [Op.lt]: new Date()
                        }
                    },
                    returning: true
                }
            );

            console.log(`Updated ${expiredSubscriptions[1] || 0} expired subscriptions`);
        } catch (error) {
            console.error('Error checking expired subscriptions:', error);
        }
    }),

    // Send renewal reminders - runs every day at 9 AM
    sendRenewalReminders: cron.schedule('0 9 * * *', async () => {
        try {
            // Find subscriptions expiring in 7 days
            const expiringSubscriptions = await UserSubscription.findAll({
                where: {
                    status: 'active',
                    endDate: {
                        [Op.between]: [
                            new Date(),
                            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                        ]
                    }
                },
                include: [
                    {
                        model: User,
                        attributes: ['email', 'fullName', 'businessName']
                    },
                    {
                        model: SubscriptionPlan,
                        attributes: ['name', 'price']
                    }
                ]
            });

            // Send reminder emails
            for (const subscription of expiringSubscriptions) {
                const daysRemaining = Math.ceil(
                    (new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)
                );

                await EmailService.sendSubscriptionReminder({
                    email: subscription.User.email,
                    userName: subscription.User.fullName,
                    businessName: subscription.User.businessName,
                    planName: subscription.SubscriptionPlan.name,
                    expiryDate: subscription.endDate,
                    daysRemaining
                });
            }

            console.log(`Sent reminders for ${expiringSubscriptions.length} expiring subscriptions`);
        } catch (error) {
            console.error('Error sending renewal reminders:', error);
        }
    })
};

module.exports = SchedulerService; 