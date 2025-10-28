const sequelize = require('../db');
const { UserRole, UserSubscription, SubscriptionPlan, User } = require('../entity');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');

const UserRoleService = {
    async addChildUser(parentId, userData) {
        const transaction = await sequelize.transaction();
        try {

            const userInfo = await User.findByPk(parentId);

            if (!userInfo) {
                return {
                    status: false,
                    message: "User not found",
                    data: null
                };
            }


            // Check subscription limits
            const subscription = await UserSubscription.findOne({
                where: {
                    UserId: parentId,
                    status: 'active',
                    endDate: {
                        [Op.gt]: new Date()
                    }
                },
                include: [{
                    model: SubscriptionPlan
                }]
            });

            if (!subscription && userInfo?.accountType !== "super admin") {
                throw new Error("No active subscription found");
            }

            // Check user limit
            const currentUserCount = await UserRole.count({
                where: {
                    parentUserId: parentId,
                    status: 'active'
                }
            });

            if (userInfo?.accountType !== "super admin" && currentUserCount >= subscription.SubscriptionPlan.maxUsers) {
                throw new Error("User limit reached for your subscription plan");
            }

            // Check if email already exists
            const existingUser = await UserRole.findOne({
                where: { email: userData.email }
            });

            const existingParent = await User.findOne({
                where: { email: userData.email }
            });

            if (existingUser || existingParent) {
                throw new Error("Email already exists");
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            // Create user role
            const userRole = await UserRole.create({
                ...userData,
                password: hashedPassword,
                parentUserId: parentId,
                permissions: userData.permissions || getDefaultPermissions(userData.role)
            }, { transaction });

            await transaction.commit();

            // Remove password from response
            const userRoleResponse = userRole.toJSON();
            delete userRoleResponse.password;

            return {
                status: true,
                message: "Child user created successfully",
                data: userRoleResponse
            };

        } catch (error) {
            await transaction.rollback();
            return {
                status: false,
                message: error.message || "Failed to create child user",
                error: error.message
            };
        }
    },

    async updateUserRole(id, updateData, parentId) {
        try {
            const userRole = await UserRole.findOne({
                where: {
                    id,
                    parentUserId: parentId
                }
            });

            if (!userRole) {
                return {
                    status: false,
                    message: "User role not found",
                    data: null
                };
            }

            // If updating password, hash it
            if (updateData.password) {
                updateData.password = await bcrypt.hash(updateData.password, 10);
            }
            else {
                updateData.password = undefined
            }

            // If updating email, check if it exists
            if (updateData.email && updateData.email !== userRole.email) {
                const existingUser = await UserRole.findOne({
                    where: { email: updateData.email }
                });

                const existingParent = await User.findOne({
                    where: { email: userData.email }
                });

                if (existingUser || existingParent) {
                    return {
                        status: false,
                        message: "Email already exists",
                        data: null
                    };
                }
            }

            await userRole.update(updateData);

            // Remove password from response
            const userRoleResponse = userRole.toJSON();
            delete userRoleResponse.password;

            return {
                status: true,
                message: "User role updated successfully",
                data: userRoleResponse
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to update user role",
                error: error.message
            };
        }
    },

    async getChildUsers(parentId, query = {}) {
        try {
            const page = parseInt(query.page) || 1;
            const pageSize = parseInt(query.pageSize) || 10;
            const offset = (page - 1) * pageSize;
      
            // Build where clause
            const whereClause = {
                parentUserId: parentId
            };

            // Add role and status filters
            if (query.role) whereClause.role = query.role;
            if (query.status) whereClause.status = query.status;

            // Add search conditions
            if (query.searchKey) {
                whereClause[Op.or] = [
                    { fullName: { [Op.like]: `%${query.searchKey}%` } },
                    { email: { [Op.like]: `%${query.searchKey}%` } },
                    { phone: { [Op.like]: `%${query.searchKey}%` } }
                ];
            }

            // Get total count for pagination
            const totalCount = await UserRole.count({ where: whereClause });

            // Get paginated results
            const childUsers = await UserRole.findAll({
                where: whereClause,
                attributes: { exclude: ['password'] },
                include: [{
                    model: User,
                    as: "parent"
                }],
                order: [['createdAt', 'DESC']],
                limit: pageSize,
                offset: offset
            });

            return {
                status: true,
                message: "Child users retrieved successfully",
                data: {
                    users: childUsers,
                    pagination: {
                        page,
                        pageSize,
                        totalCount,
                        totalPages: Math.ceil(totalCount / pageSize),
                        hasMore: page < Math.ceil(totalCount / pageSize)
                    }
                }
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to retrieve child users",
                error: error.message
            };
        }
    },

    async deleteChildUser(id, parentId) {
        try {
            const userRole = await UserRole.findOne({
                where: {
                    id,
                    parentUserId: parentId
                }
            });

            if (!userRole) {
                return {
                    status: false,
                    message: "User role not found",
                    data: null
                };
            }

            await userRole.destroy();

            return {
                status: true,
                message: "Child user deleted successfully",
                data: null
            };
        } catch (error) {
            return {
                status: false,
                message: "Failed to delete child user",
                error: error.message
            };
        }
    }
};

// Helper function to get default permissions based on role
function getDefaultPermissions(role) {
    const permissions = {
        manager: {
            products: ['view', 'create', 'edit', 'delete'],
            orders: ['view', 'create', 'edit', 'delete'],
            reports: ['view'],
            settings: ['view', 'edit']
        },
        employee: {
            products: ['view'],
            orders: ['view', 'create'],
            reports: ['view'],
            settings: ['view']
        }
    };

    return permissions[role] || {};
}

module.exports = UserRoleService; 