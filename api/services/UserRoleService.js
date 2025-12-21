const sequelize = require("../db");
const {
  UserRole,
  UserSubscription,
  SubscriptionPlan,
  User,
} = require("../entity");
const SalaryHistory = require("../entity/SalaryHistory");
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");
const moment = require("moment");
const Attendance = require("../entity/Attendance");
const PayrollService = require("./PayrollService");

const UserRoleService = {
  async addChildUser(parentId, userData) {
    const transaction = await sequelize.transaction();
    try {
      const userInfo = await User.findByPk(parentId);

      if (!userInfo) {
        return {
          status: false,
          message: "User not found",
          data: null,
        };
      }

      // Check subscription limits
      const subscription = await UserSubscription.findOne({
        where: {
          UserId: parentId,
          status: "active",
          endDate: {
            [Op.gt]: new Date(),
          },
        },
        include: [
          {
            model: SubscriptionPlan,
          },
        ],
      });

      if (!subscription && userInfo?.accountType !== "super admin") {
        throw new Error("No active subscription found");
      }

      // Check user limit
      const currentUserCount = await UserRole.count({
        where: {
          parentUserId: parentId,
          status: "active",
        },
      });

      if (
        userInfo?.accountType !== "super admin" &&
        currentUserCount >= subscription.SubscriptionPlan.maxUsers
      ) {
        throw new Error("User limit reached for your subscription plan");
      }

      // Check if email already exists
      const existingUser = await UserRole.findOne({
        where: { email: userData.email },
      });

      const existingParent = await User.findOne({
        where: { email: userData.email },
      });

      if (existingUser || existingParent) {
        throw new Error("Email already exists");
      }

      // In createUserRole
      if (!userData?.baseSalary || userData?.baseSalary <= 0) {
        throw new Error("Base salary is required and must be greater than 0");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user role
      const userRole = await UserRole.create(
        {
          ...userData,
          password: hashedPassword,
          parentUserId: parentId,
          permissions:
            userData.permissions || getDefaultPermissions(userData.role),

          // TODO:: BASE SALARY AND REQUIRED DAILY HOURS will be required when creating not updating
          baseSalary: userData.baseSalary, // Added
          requiredDailyHours: userData.requiredDailyHours, // Added
        },
        { transaction }
      );

      // Add initial salary history if baseSalary provided (case 1,3)
      if (userData.baseSalary) {
        await SalaryHistory.create(
          {
            userId: userRole.id,
            salary: userData.baseSalary,
            startDate: new Date(), // Current date as start
            status: "initial",
            previousSalary: null,
          },
          { transaction }
        );
      }

      await transaction.commit();

      // Remove password from response
      const userRoleResponse = userRole.toJSON();
      delete userRoleResponse.password;

      return {
        status: true,
        message: "Child user created successfully",
        data: userRoleResponse,
      };
    } catch (error) {
      await transaction.rollback();
      return {
        status: false,
        message: error.message || "Failed to create child user",
        error: error.message,
      };
    }
  },

  async updateUserRole(id, updateData, accessibleShopIds) {
    const transaction = await sequelize.transaction();
    try {
      const userRole = await UserRole.findOne({
        where: {
          id,
          parentUserId: { [Op.in]: accessibleShopIds },
        },
      });

      if (!userRole) {
        return {
          status: false,
          message: "User role not found",
          data: null,
        };
      }

      // If updating password, hash it
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      } else {
        updateData.password = undefined;
      }

      // If updating email, check if it exists
      if (updateData.email && updateData.email !== userRole.email) {
        const existingUser = await UserRole.findOne({
          where: { email: updateData.email },
        });

        const existingParent = await User.findOne({
          where: { email: updateData.email },
        });

        if (existingUser || existingParent) {
          return {
            status: false,
            message: "Email already exists",
            data: null,
          };
        }
      }

      // Inside updateUserRole
      if (updateData.baseSalary !== undefined) {
        if (userRole.baseSalary === null) {
          // Allow first-time set
        } else if (Number(updateData.baseSalary) !== Number(userRole.baseSalary)) {
          return {
            status: false,
            message: "Salary cannot be updated. It is locked after creation.",
            data: null,
          };
        } else {
          delete updateData.baseSalary;
        }
      }

      // // Handle salary update (case 2,3)
      // let salaryStatus = null;
      // let previousSalary = null;
      // if (
      //   updateData.baseSalary &&
      //   updateData.baseSalary !== userRole.baseSalary
      // ) {
      //   previousSalary = userRole.baseSalary;
      //   if (updateData.baseSalary > previousSalary) {
      //     salaryStatus = "promotion";
      //   } else if (updateData.baseSalary < previousSalary) {
      //     salaryStatus = "demotion";
      //   }
      //   // Add to history
      //   await SalaryHistory.create(
      //     {
      //       userId: id,
      //       salary: updateData.baseSalary,
      //       startDate: new Date(), // Immediate effect, or specify in body if needed
      //       status: salaryStatus || "initial",
      //       previousSalary: previousSalary,
      //     },
      //     { transaction }
      //   );
      // }

      await userRole.update(updateData, { transaction });

      await transaction.commit();

      // Remove password from response
      const userRoleResponse = userRole.toJSON();
      delete userRoleResponse.password;

      return {
        status: true,
        message: "User role updated successfully",
        data: userRoleResponse,
      };
    } catch (error) {
      await transaction.rollback();
      return {
        status: false,
        message: "Failed to update user role",
        error: error.message,
      };
    }
  },
  async getChildUsers(accessibleShopIds, query = {}) {
    try {
      const page = parseInt(query.page) || 1;
      const pageSize = parseInt(query.pageSize) || 10;
      const offset = (page - 1) * pageSize;

      // Base where clause
      const whereClause = {
        parentUserId: { [Op.in]: accessibleShopIds },
      };

      if (query.role) whereClause.role = query.role;
      if (query.status) whereClause.status = query.status;

      if (query.searchKey) {
        whereClause[Op.or] = [
          { fullName: { [Op.like]: `%${query.searchKey}%` } },
          { email: { [Op.like]: `%${query.searchKey}%` } },
          { phone: { [Op.like]: `%${query.searchKey}%` } },
        ];
      }

      // === TOTAL COUNT ===
      const totalCount = await UserRole.count({ where: whereClause });

      // === FETCH USERS ===
      const childUsers = await UserRole.findAll({
        where: whereClause,
        attributes: { exclude: ["password"] },
        include: [{ model: User, as: "parent" }],
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset: offset,
      });

      // === ATTENDANCE TODAY ===
      if (query.withAttendance === "true") {
        const today = moment().format("YYYY-MM-DD");
        const userIds = childUsers.map((u) => u.id);

        const todaysAttendance = await Attendance.findAll({
          where: {
            userId: { [Op.in]: userIds },
            date: today,
          },
          attributes: [
            "userId",
            "type",
            "isHalfDay",
            "reason",
            "notes",
            "lateMinutes",
            "extraMinutes",
            "date",
          ],
        });

        const attendanceMap = {};
        todaysAttendance.forEach((a) => {
          attendanceMap[a.userId] = {
            type: a.type,
            isHalfDay: a.isHalfDay,
            reason: a.reason,
            notes: a.notes,
            lateMinutes: a.lateMinutes || 0,
            extraMinutes: a.extraMinutes || 0,
            date: a.date,
          };
        });

        childUsers.forEach((user) => {
          const att = attendanceMap[user.id];
          if (att) {
            user.dataValues.attendanceType = att.type; // "present" | "absent"
            user.dataValues.attendanceDate = att.date;
            user.dataValues.isHalfDay = att.isHalfDay;
            user.dataValues.reason = att.reason;
            user.dataValues.notes = att.notes;
            user.dataValues.lateMinutes = att.lateMinutes;
            user.dataValues.extraMinutes = att.extraMinutes;
          } else {
            user.dataValues.attendanceType = null;
            user.dataValues.attendanceDate = null;
            user.dataValues.isHalfDay = false;
            user.dataValues.reason = null;
            user.dataValues.notes = null;
            user.dataValues.lateMinutes = 0;
            user.dataValues.extraMinutes = 0;
          }
        });
      }

      // === RESPONSE: EXACTLY MATCHES FRONTEND ===
      return {
        status: true,
        message: "Child users retrieved successfully",
        data: {
          users: childUsers.map((u) => u.dataValues),
          pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
            hasMore: page < Math.ceil(totalCount / pageSize),
          },
        },
      };
    } catch (error) {
      console.error("getChildUsers error:", error);
      return {
        status: false,
        message: "Failed to retrieve child users",
        error: error.message,
      };
    }
  },

  async deleteChildUser(id, accessibleShopIds) {
    try {
      const userRole = await UserRole.findOne({
        where: {
          id,
          parentUserId: { [Op.in]: accessibleShopIds },
        },
      });

      if (!userRole) {
        return {
          status: false,
          message: "User role not found",
          data: null,
        };
      }

      await userRole.destroy();

      return {
        status: true,
        message: "Child user deleted successfully",
        data: null,
      };
    } catch (error) {
      return {
        status: false,
        message: "Failed to delete child user",
        error: error.message,
      };
    }
  },

  async getUserProfile(id, accessibleShopIds) {
    try {
      // 1. Get User Details
      const user = await UserRole.findOne({
        where: {
          id,
          parentUserId: { [Op.in]: accessibleShopIds },
        },
        include: [
          {
            model: User, // For parent info if needed, or other associations
            as: "parent"
          },
        ],
        attributes: { exclude: ["password"] },
      });

      if (!user) {
        return {
          status: false,
          message: "User not found",
          data: null,
        };
      }

      // 2. Get Financial details from PayrollService
      const financialSummary = await PayrollService.getLifetimeFinancials(id);

      // 3. Get latest Salary History (Current Status)
      const latestSalary = await SalaryHistory.findOne({
        where: { userId: id },
        order: [["startDate", "DESC"]],
      });

      // 4. Calculate Current Month Salary Details
      const currentMonth = moment().format("YYYY-MM");
      const currentMonthSalaryResult = await PayrollService.calculateMonthlyPayrollDetails(
        accessibleShopIds,
        id,
        currentMonth
      );

      // 5. Combine Data
      const profileData = {
        ...user.toJSON(),
        financials: {
          ...financialSummary,
          currentBaseSalary: user.baseSalary,
          lastSalaryUpdate: latestSalary ? latestSalary.startDate : null,
          salaryStatus: latestSalary ? latestSalary.status : "initial",
        },
        currentMonthSalary: currentMonthSalaryResult.status
          ? currentMonthSalaryResult.data
          : null,
      };

      return {
        status: true,
        message: "User profile fetched successfully",
        data: profileData,
      };
    } catch (error) {
      console.error("getUserProfile error:", error);
      return {
        status: false,
        message: "Failed to fetch user profile",
        error: error.message,
      };
    }
  },
};

// Helper function to get default permissions based on role
function getDefaultPermissions(role) {
  const permissions = {
    manager: {
      products: ["view", "create", "edit", "delete"],
      orders: ["view", "create", "edit", "delete"],
      reports: ["view"],
      settings: ["view", "edit"],
    },
    employee: {
      products: ["view"],
      orders: ["view", "create"],
      reports: ["view"],
      settings: ["view"],
    },
  };

  return permissions[role] || {};
}

module.exports = UserRoleService;
