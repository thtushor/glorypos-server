const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, UserSubscription, SubscriptionPlan, UserRole } = require('../entity');
const EmailService = require('./EmailService');
const { Op } = require('sequelize');

const AuthService = {
    async register(userData) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            if (userData.accountType === "super admin") {
                const isExistSuperAdmin = await User.findOne({
                    where: {
                        accountType: "super admin"
                    }
                })

                if (isExistSuperAdmin) {
                    return { status: false, message: "Super admin already exist", data: null };
                }
            }

            const user = await User.create({
                ...userData,
                password: hashedPassword,
                accountStatus: 'inactive',
                isVerified: false
            });

            await EmailService.sendVerificationEmail(user)

            // await EmailService.sendVerificationEmail(user);

            return {
                status: true,
                message: 'Registration successful. Please check your email to verify your account.',
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.fullName
                }
            };
        } catch (error) {
            throw error;
        }
    },

    async registerSuperAdmin(userData) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            // Check if a super admin already exists
            const existingSuperAdmin = await User.findOne({
                where: { accountType: "super admin" }
            });

            if (existingSuperAdmin) {
                // If a super admin exists, update it with the new data
                await User.update(
                    {
                        fullName: userData.fullName,
                        email: userData.email,
                        password: hashedPassword,
                        accountStatus: 'active',
                        isVerified: true
                    },
                    { where: { id: existingSuperAdmin.id } }
                );

                return {
                    status: true,
                    message: 'Super admin updated successfully.',
                    user: {
                        id: existingSuperAdmin.id,
                        email: userData.email,
                        fullName: userData.fullName
                    }
                };
            } else {
                // If no super admin exists, create a new one
                const newSuperAdmin = await User.create({
                    ...userData,
                    password: hashedPassword,
                    accountType: "super admin",
                    accountStatus: 'active',
                    isVerified: true
                });

                return {
                    status: true,
                    message: 'Super admin created successfully.',
                    user: {
                        id: newSuperAdmin.id,
                        email: newSuperAdmin.email,
                        fullName: newSuperAdmin.fullName
                    }
                };
            }
        } catch (error) {
            throw error;
        }
    },

    async verifyEmail(token, email) {
        try {
            const user = await User.findOne({ where: { verificationToken: token, email } });

            if (!user) {
                throw new Error('Invalid verification token');
            }

            await user.update({
                isVerified: true,
                verificationToken: null
            });

            return {
                status: true,
                message: 'Email verified successfully'
            };
        } catch (error) {
            throw error;
        }
    },

    async login(email, password) {
        try {
            const user = await User.findOne({ where: { email } });

            const childUser = await UserRole.findOne({
                where: { email }, include: [

                    {
                        model: User,
                        as: "parent"
                    }
                ]
            })

            if (!user && !childUser) {
                throw new Error('User not found');
            }



            if (user && !user.isVerified) {

                await EmailService.sendVerificationEmail(user)
                // throw new Error('Please verify your email before logging in');
                return { status: false, message: "Please verify your email before logging in. We have sent you a new verification email.", data: null };
            }


            const isPasswordValid = await bcrypt.compare(password, user ? user.password : childUser.password);

            if (!isPasswordValid) {
                return { status: false, message: "Invalid Password", data: null };
            }

            const token = jwt.sign({ id: user ? user?.id : childUser?.parentUserId, childId: childUser?.id }, process.env.JWT_SECRET, { expiresIn: '15d' });
            return { status: true, message: "Login successful", data: { user: user ? user : { ...childUser.parent?.dataValues, child: childUser }, token } };
        } catch (error) {
            throw error;
        }
    },

    async getProfile(email) {
        try {
            const user = await User.findOne({ where: { email } });

            const childUser = await UserRole.findOne({
                where: { email }, include: [

                    {
                        model: User,
                        as: "parent"
                    }
                ]
            })


            if (!user && !childUser) {
                return { status: false, message: "User not found", data: null };
            }

            return { status: true, message: "Profile retrieved successfully", data: user ? user : { ...childUser.parent?.dataValues, child: childUser } };

        } catch (error) {
            return { status: false, message: "Failed to retrieve profile", data: null, error };
        }
    },

    async getUserById(userId) {
        try {
            const user = await User.findOne(
                {
                    where: {
                        id: userId
                    }
                }
            );




            if (!user) {
                return { status: false, message: "User not found", data: null };
            }

            return { status: true, message: "Profile retrieved successfully", data: user };

        } catch (error) {
            return { status: false, message: "Failed to retrieve profile", data: null, error };
        }
    },

    async updateProfile(userId, updateData) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                return { status: false, message: "User not found", data: null, };
            }

            if (updateData.accountType === "super admin") {
                const isExistSuperAdmin = await User.findOne({
                    where: {
                        accountType: "super admin"
                    }
                })

                if (isExistSuperAdmin) {
                    return { status: false, message: "Super admin already exist", data: null };
                }
            }

            await user.update(updateData);
            return { status: true, message: "Profile updated successfully", data: user };
        } catch (error) {
            return { status: false, message: "Failed to update profile", data: null, error };
        }
    },

    async authenticate(req, res, next) {
        try {
            const token = req.headers.authorization?.split(" ")[1] || req.query.token;

            if (!token) {
                return res.status(401).json({ status: false, message: "No token provided", data: null });
            }

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (error) {
                return res.status(401).json({ status: false, message: "Invalid or expired token", data: null });
            }

            const user = await User.findByPk(decoded.id);

            if (!user) {
                return res.status(404).json({ status: false, message: "User not found", data: null });
            }

            if (user.accountStatus === "inactive") {
                return res.status(401).json({ status: false, message: "User is not active. Please contact with support", data: null });
            }

            req.user = user;

            next();
        } catch (error) {
            return res.status(500).json({ status: false, message: "Authentication failed", data: null, error });
        }
    },

    async requestPasswordReset(email) {
        try {
            const user = await User.findOne({ where: { email } });

            if (!user) {
                throw new Error('User not found');
            }

            // Generate reset token
            const resetToken = jwt.sign(
                { userId: user.id },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Save reset token and expiry in database
            await user.update({
                resetToken: resetToken,
                resetTokenExpiry: new Date(Date.now() + 3600000) // 1 hour from now
            });

            // Send reset email
            await EmailService.sendResetPasswordEmail(email, resetToken);

            return {
                status: true,
                message: 'Password reset link sent to your email',
                data: null
            };
        } catch (error) {
            throw error;
        }
    },

    async verifyResetToken(token) {
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const user = await User.findOne({
                where: {
                    id: decoded.userId,
                    resetToken: token,
                    resetTokenExpiry: {
                        [Op.gt]: new Date()
                    }
                }
            });

            if (!user) {
                throw new Error('Invalid or expired reset token');
            }

            return {
                status: true,
                message: 'Token verified successfully',
                data: { userId: user.id }
            };
        } catch (error) {
            throw error;
        }
    },

    async resetPassword(token, newPassword) {
        try {
            // Verify token first
            const { data: { userId } } = await this.verifyResetToken(token);

            const user = await User.findByPk(userId);

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password and clear reset token
            await user.update({
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            });

            return {
                status: true,
                message: 'Password reset successful',
                data: null
            };
        } catch (error) {
            throw error;
        }
    },

    async getAllUsers(query, UserId) {
        try {
            const page = parseInt(query.page) || 1;
            const pageSize = parseInt(query.pageSize) || 10;
            const offset = (page - 1) * pageSize;

            // Build where clause
            const whereClause = {};


            const getUserData = await User.findByPk(UserId);

            if (getUserData.accountType !== "super admin") {
                whereClause.id = UserId;
            }

            // Add search functionality
            if (query.searchKey) {
                whereClause[Op.or] = [
                    { email: { [Op.like]: `%${query.searchKey}%` } },
                    { phoneNumber: { [Op.like]: `%${query.searchKey}%` } }
                ];
            }

            // Add filters
            if (query.accountStatus) whereClause.accountStatus = query.accountStatus;
            if (query.accountType) whereClause.accountType = query.accountType;

            const { count, rows } = await User.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: UserSubscription,
                        required: false, // LEFT JOIN to include users without subscriptions
                        where: {
                            status: 'active',
                            endDate: {
                                [Op.gt]: new Date()
                            },
                            paymentStatus: 'completed'
                        },

                        include: [
                            {
                                model: SubscriptionPlan
                            }
                        ]
                    }
                ],
                order: [['createdAt', 'DESC']],
                limit: pageSize,
                offset
            });

            const totalPages = Math.ceil(count / pageSize);

            return {
                status: true,
                message: "Users retrieved successfully",
                data: {
                    users: rows,
                    pagination: {
                        page,
                        pageSize,
                        totalPages,
                        totalItems: count,
                        hasNextPage: page < totalPages,
                        hasPreviousPage: page > 1
                    }
                }
            };

        } catch (error) {
            console.log({ error })
            throw error;
        }
    },

    isAdmin: async (req, res, next) => {
        try {
            // Check if user exists in request (should be added by authenticate middleware)
            if (!req?.user?.id) {
                return res.status(401).json({
                    status: false,
                    message: "Authentication required"
                });
            }


            if (req?.user.accountType !== "super admin") {
                return res.status(401).json({ status: false, message: "Admin access required", data: null });
            }

            // If user is admin, proceed to next middleware
            next();
        } catch (error) {
            return res.status(500).json({
                status: false,
                message: "Error checking admin status",
                error: error.message
            });
        }
    }
};

module.exports = AuthService;


