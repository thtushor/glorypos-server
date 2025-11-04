const nodemailer = require('nodemailer');
const crypto = require('crypto');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            // port: 587,
            secure: false, // Important: STARTTLS uses secure=false
            auth: {
                user: process.env.ADMIN_EMAIL,
                pass: process.env.ADMIN_PASSWORD
            }
        });
    }

    async sendVerificationEmail(user) {
        // Generate verification token
        const token = crypto.randomBytes(32).toString('hex');

        // Save token to user
        await user.update({ verificationToken: token });

        // Create verification URL
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}&email=${user.email}`;
        // Email content
        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: user.email,
            subject: 'Verify Your Email Address',
            html: `
                <h1>Welcome to FG POS!</h1>
                <p>Please click the link below to verify your email address:</p>
                <a href="${verificationUrl}">Verify Email</a>
                <p>If you didn't create this account, please ignore this email.</p>
            `
        };

        // Send email
        return this.transporter.sendMail(mailOptions);
    }

    async sendResetPasswordEmail(email, token) {
        const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: email,
            subject: 'Password Reset Request',
            html: `
                <h1>Password Reset Request</h1>
                <p>You requested to reset your password. Please click the link below to reset your password:</p>
                <a href="${resetLink}">Reset Password</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.log('Email sending failed:', error);
            throw new Error('Failed to send reset password email');
        }
    }

    async sendSubscriptionReminder(data) {
        const { email, userName, businessName, planName, expiryDate, daysRemaining } = data;

        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: email,
            subject: `Subscription Renewal Reminder - ${daysRemaining} days remaining`,
            html: `
            <h2>Subscription Renewal Reminder</h2>
            <p>Dear ${userName},</p>
            <p>Your subscription for ${businessName} is expiring soon.</p>
            <p><strong>Plan Details:</strong></p>
            <ul>
                <li>Plan: ${planName}</li>
                <li>Expiry Date: ${new Date(expiryDate).toLocaleDateString()}</li>
                <li>Days Remaining: ${daysRemaining}</li>
            </ul>
            <p>Please renew your subscription to continue using our services without interruption.</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
        `
        };

        return this.transporter.sendMail(mailOptions);
    }
}

module.exports = new EmailService(); 