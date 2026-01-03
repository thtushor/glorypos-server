const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, UserSubscription, SubscriptionPlan, UserRole } = require('../entity');
const EmailService = require('./EmailService');
const { Op } = require('sequelize');

const AuthService = {
    async register(userData) {
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
            parent_id: userData?.parentId,
            password: hashedPassword,
            accountStatus: 'inactive',
            isVerified: false
        });

        // Check if email service is enabled
        const isEmailServiceEnabled = process.env.ENABLE_EMAIL_SERVICE === 'true';

        if (!userData?.ignoreEmailVerification && isEmailServiceEnabled) {
            try {
                await EmailService.sendVerificationEmail(user)
            } catch (error) {
                return { status: false, message: "Failed to send verification email", data: null, error };
            }
        }

        const message = isEmailServiceEnabled
            ? "Registration successful. Please check your email to verify your account."
            : "Registration successful. Please contact customer support or admin to activate your account.";

        return { status: true, message, data: user };
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

            const parentShop = user?.parent_id ? await User.findOne({ where: { id: user.parent_id } }) : null;

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
                const isEmailServiceEnabled = process.env.ENABLE_EMAIL_SERVICE === 'true';

                if (isEmailServiceEnabled) {
                    await EmailService.sendVerificationEmail(user)
                    return { status: false, message: "Please verify your email before logging in. We have sent you a new verification email.", data: null };
                } else {
                    return { status: false, message: "Your account is not verified. Please contact customer support or admin to activate your account.", data: null };
                }
            }


            const isPasswordValid = await bcrypt.compare(password, user ? user.password : childUser.password);

            if (!isPasswordValid) {
                return { status: false, message: "Invalid Password", data: null };
            }

            const token = jwt.sign({ id: user ? user?.id : childUser?.parentUserId, childId: childUser?.id }, process.env.JWT_SECRET, { expiresIn: '15d' });

            // Ensure permissions is always an array of strings
            let permissions = [];
            if (childUser?.permissions) {
                if (Array.isArray(childUser.permissions)) {
                    permissions = childUser.permissions.filter(p => typeof p === 'string');
                } else if (typeof childUser.permissions === 'string') {
                    try {
                        const parsed = JSON.parse(childUser.permissions);
                        permissions = Array.isArray(parsed) ? parsed.filter(p => typeof p === 'string') : [];
                    } catch (e) {
                        permissions = [];
                    }
                }
            }

            return { status: true, message: "Login successful", data: { user: user ? { ...user.dataValues, parentShop } : { ...childUser.parent?.dataValues, parentShop, child: { ...childUser?.dataValues, permissions } }, token } };
        } catch (error) {
            throw error;
        }
    },

    async getProfile(email) {
        const user = await User.findOne({ where: { email } });

        const parentShop = user?.parent_id ? await User.findOne({ where: { id: user.parent_id } }) : null;

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

        // Ensure permissions is always an array of strings
        let permissions = [];
        if (childUser?.permissions) {
            if (Array.isArray(childUser.permissions)) {
                permissions = childUser.permissions.filter(p => typeof p === 'string');
            } else if (typeof childUser.permissions === 'string') {
                try {
                    const parsed = JSON.parse(childUser.permissions);
                    permissions = Array.isArray(parsed) ? parsed.filter(p => typeof p === 'string') : [];
                } catch (e) {
                    permissions = [];
                }
            }
        }

        return { status: true, message: "Profile retrieved successfully", data: user ? { ...user.dataValues, parentShop } : { ...childUser.parent?.dataValues, parentShop, child: { ...childUser?.dataValues, permissions } } };
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

                if (isExistSuperAdmin && isExistSuperAdmin.id !== userId) {
                    return { status: false, message: "Super admin already exist", data: null };
                }
            }


            // Check if email is being changed and if it's already taken by another user
            if (updateData.email && updateData.email !== user.email) {
                const existingUserWithEmail = await User.findOne({
                    where: { email: updateData.email }
                });
                if (existingUserWithEmail) {
                    return { status: false, message: "Email is already in use by another user", data: null };
                }
            }

            // Check if phone number is being changed and if it's already taken by another user
            if (updateData.phoneNumber && updateData.phoneNumber !== user.phoneNumber) {
                const existingUserWithPhone = await User.findOne({
                    where: { phoneNumber: updateData.phoneNumber }
                });
                if (existingUserWithPhone) {
                    return { status: false, message: "Phone number is already in use by another user", data: null };
                }
            }


            if (updateData.hasOwnProperty('isVerified')) {
                updateData.isVerified = Boolean(updateData.isVerified === true || updateData.isVerified === 1 || updateData.isVerified === "true");
            }

            await user.update(updateData);

            return { status: true, message: "Profile updated successfully", data: user };
        } catch (error) {
            return { status: false, message: "Failed to update profile", data: null, error };
        }
    },

    async authenticate(req, res, next) {
        try {
            // Prioritize cookie-based authentication (httpOnly, secure)
            // Fallback to Authorization header for API clients if needed
            const token = req.cookies?.access_token ||
                req.headers.authorization?.replace('Bearer ', '')?.replace('bearer ', '') ||
                req.query.token;

            if (!token) {
                return res.status(401).json({
                    status: false,
                    message: "Authentication required. Please login.",
                    data: null
                });
            }

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (error) {
                // Clear invalid cookie if present
                if (req.cookies?.access_token) {
                    res.clearCookie('access_token');
                }
                return res.status(401).json({
                    status: false,
                    message: "Invalid or expired token. Please login again.",
                    data: null
                });
            }

            const user = await User.findByPk(decoded.id);

            if (!user) {
                return res.status(404).json({
                    status: false,
                    message: "User not found",
                    data: null
                });
            }

            if (user.accountStatus === "inactive") {
                return res.status(401).json({
                    status: false,
                    message: "User account is inactive. Please contact support",
                    data: null
                });
            }

            // Attach user to request object for use in route handlers
            req.user = user;
            req.email = req?.user?.email;
            if (decoded.childId) {
                const childUser = await UserRole.findByPk(decoded.childId);
                if (!childUser) {
                    return res.status(404).json({
                        status: false,
                        message: "Child user not found",
                        data: null
                    });
                }

                req.user.child = childUser;

                req.email = req?.user?.child?.email;
            }

            next();
        } catch (error) {
            return res.status(500).json({
                status: false,
                message: "Authentication failed",
                data: null,
                error: error.message
            });
        }
    },

    async requestPasswordReset(email, reqUserId) {
        try {

            let reqUser;

            if (Number(reqUserId)) {
                reqUser = await User.findByPk(Number(reqUserId));
            }

            const user = await User.findOne({ where: { email } });

            const childUser = await UserRole.findOne({ where: { email } });

            if (!user && !childUser) {
                throw new Error('User not found');
            }

            const isEmailServiceEnabled = process.env.ENABLE_EMAIL_SERVICE === 'true';

            // Authorization logic
            let isEligibleForSendResetLink = false;

            if (reqUserId && reqUser) {
                // Case 1: Super admin can reset anyone's password
                if (reqUser.accountType === "super admin") {
                    isEligibleForSendResetLink = true;
                }
                // Case 2: For regular User (not child)
                else if (user) {
                    // If target user has no parent (is a shop owner)
                    if (!user.parent_id) {
                        // Shop owner can only reset their own password
                        isEligibleForSendResetLink = (reqUser.id === user.id);
                    }
                    // If target user has a parent (is a sub-shop)
                    else {
                        // Parent can reset their child's password
                        isEligibleForSendResetLink = (reqUser.id === user.parent_id);
                    }
                }
                // Case 3: For child user (UserRole)
                else if (childUser) {
                    // Only the parent shop owner can reset child user's password
                    isEligibleForSendResetLink = (reqUser.id === childUser.parentUserId);
                }
            } else {
                // No reqUserId means public password reset request (via email)
                isEligibleForSendResetLink = false;
            }

            if (reqUserId && !isEligibleForSendResetLink) {
                return {
                    status: false,
                    message: 'You are not authorized to reset this password',
                    data: null
                };
            }


            // Generate reset token (always, for admin use)
            const resetToken = jwt.sign(
                (user?.id ? { userId: user?.id } : { userRoleId: childUser?.id }),
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );


            const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

            // Save reset token and expiry in database

            if (user) {
                await user.update({
                    resetToken: resetToken,
                    resetTokenExpiry: new Date(Date.now() + 3600000) // 1 hour from now
                });
            }

            if (childUser) {
                await childUser.update({
                    resetToken: resetToken,
                    resetTokenExpiry: new Date(Date.now() + 3600000) // 1 hour from now
                });
            }

            if (isEligibleForSendResetLink && reqUserId) {

                return {
                    status: true,
                    message: 'Password reset link requested successfully',
                    data: {
                        resetLink
                    }
                };
            }

            // Send reset email only if email service is enabled
            if (isEmailServiceEnabled) {
                await EmailService.sendResetPasswordEmail(email, resetToken);
                return {
                    status: true,
                    message: 'Password reset link sent to your email',
                    data: null
                };
            } else {
                return {
                    status: true,
                    message: 'Password reset request received. Please contact customer support or admin for assistance with resetting your password.',
                    data: null
                };
            }
        } catch (error) {
            throw error;
        }
    },

    async verifyResetToken(token) {
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const user = decoded.userId ? await User.findOne({
                where: {
                    id: decoded.userId,
                    resetToken: token,
                    resetTokenExpiry: {
                        [Op.gt]: new Date()
                    }
                }
            }) : null;

            const childUser = decoded.userRoleId ? await UserRole.findOne({
                where: {
                    id: decoded.userRoleId,
                    resetToken: token,
                    resetTokenExpiry: {
                        [Op.gt]: new Date()
                    }
                }
            }) : null;

            if (!user && !childUser) {
                throw new Error('Invalid or expired reset token');
            }

            return {
                status: true,
                message: 'Token verified successfully',
                data: { userId: user?.id, userRoleId: childUser?.id }
            };
        } catch (error) {
            throw error;
        }
    },

    async resetPassword(token, newPassword) {
        try {
            // Verify token first
            const { data: { userId, userRoleId } } = await this.verifyResetToken(token);

            const user = await User.findByPk(userId);

            const childUser = await UserRole.findByPk(userRoleId);

            if (!user && !childUser) {
                throw new Error('Invalid or expired reset token');
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password and clear reset token

            if (user) {
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
            }

            if (childUser) {
                await childUser.update({
                    password: hashedPassword,
                    resetToken: null,
                    resetTokenExpiry: null
                });
                return {
                    status: true,
                    message: 'Password reset successful',
                    data: null
                };
            }

            return {
                status: false,
                message: 'Invalid or expired reset token',
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

    async getSubShops(query, userId, accessibleShopIds = []) {
        try {
            const page = parseInt(query.page) || 1;
            const pageSize = parseInt(query.pageSize) || 10;
            const offset = (page - 1) * pageSize;
            const showParentShop = query.showParentShop || false;

            // Build where clause - filter by parent_id
            const whereClause = {
                // parent_id: undefined
            };

            // if (!showParentShop) {
            //     whereClause.parent_id = {
            //         [Op.ne]: null
            //     };
            // }

            // Apply shop access filter - only return shops the user has access to
            if (accessibleShopIds && accessibleShopIds.length > 0) {
                whereClause.id = {
                    [Op.in]: accessibleShopIds
                };
            }

            // Add search functionality
            if (query.searchKey) {
                whereClause[Op.or] = [
                    { email: { [Op.like]: `%${query.searchKey}%` } },
                    { phoneNumber: { [Op.like]: `%${query.searchKey}%` } },
                    { fullName: { [Op.like]: `%${query.searchKey}%` } },
                    { businessName: { [Op.like]: `%${query.searchKey}%` } }
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
                                model: SubscriptionPlan,
                                required: false
                            }
                        ]
                    }
                ],
                order: [['createdAt', 'DESC']],
                limit: pageSize,
                offset
            });

            const modifiedRows = await Promise.all(rows.map(async (row) => {
                const parentUser = await User.findByPk(row.parent_id);

                return {
                    ...row.dataValues,
                    parent: parentUser ? parentUser?.dataValues : undefined
                }

            }));

            const totalPages = Math.ceil(count / pageSize);

            return {
                status: true,
                message: "Sub shops retrieved successfully",
                data: {
                    users: modifiedRows,
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


