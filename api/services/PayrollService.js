// New file: PayrollService.js - Handles all payroll logic (cases 4-8)
const sequelize = require("../db");
const { Op } = require("sequelize");
const moment = require("moment");
const {
  SalaryHistory,
  Attendance,
  PayrollRelease,
  Holiday,
  LeaveRequest,
  UserRole,
  User,
} = require("../entity");

const PayrollService = {
  // Case 4: Mark multiple users present for a date
  // Case 4: Mark multiple users present for today's date

  async markMultiplePresent(adminId, { userIds }) {
    const transaction = await sequelize.transaction();
    let result;

    try {
      const date = moment().format("YYYY-MM-DD");

      // Validate users
      const users = await UserRole.findAll({
        where: { id: { [Op.in]: userIds }, parentUserId: adminId },
        transaction,
      });
      if (users.length !== userIds.length) throw new Error("Invalid users");

      // Check existing (any type)
      const existing = await Attendance.findAll({
        where: { userId: { [Op.in]: userIds }, date },
        transaction,
      });
      const alreadyMarked = existing.map((a) => a.userId);
      const newUserIds = userIds.filter((id) => !alreadyMarked.includes(id));

      if (newUserIds.length === 0) {
        throw new Error(
          "Attendance already marked for all selected users today"
        );
      }

      const records = newUserIds.map((userId) => ({
        userId,
        date,
        type: "present",
        lateMinutes: 0,
        extraMinutes: 0,
        isHalfDay: false,
      }));

      await Attendance.bulkCreate(records, { transaction });
      await transaction.commit();

      result = {
        status: true,
        message: `Marked ${newUserIds.length} as PRESENT`,
        data: records,
      };
    } catch (error) {
      await transaction.rollback();
      result = { status: false, message: error.message };
    }

    return result;
  },

  // MARK MULTIPLE ABSENT
  async markMultipleAbsent(
    adminId,
    { userIds, reason, isHalfDay = false, notes = "" }
  ) {
    const transaction = await sequelize.transaction();
    let result;

    try {
      const date = moment().format("YYYY-MM-DD");

      const users = await UserRole.findAll({
        where: { id: { [Op.in]: userIds }, parentUserId: adminId },
        transaction,
      });
      if (users.length !== userIds.length) throw new Error("Invalid users");

      const existing = await Attendance.findAll({
        where: { userId: { [Op.in]: userIds }, date },
        transaction,
      });
      const alreadyMarked = existing.map((a) => a.userId);
      const newUserIds = userIds.filter((id) => !alreadyMarked.includes(id));

      if (newUserIds.length === 0) {
        throw new Error(
          "Attendance already marked for all selected users today"
        );
      }

      const records = newUserIds.map((userId) => ({
        userId,
        date,
        type: "absent",
        reason,
        isHalfDay,
        notes,
        lateMinutes: 0,
        extraMinutes: 0,
      }));

      await Attendance.bulkCreate(records, { transaction });
      await transaction.commit();

      result = {
        status: true,
        message: `Marked ${newUserIds.length} as ABSENT`,
        data: records,
      };
    } catch (error) {
      await transaction.rollback();
      result = { status: false, message: error.message };
    }

    return result;
  },

  // UPDATE SINGLE ATTENDANCE (PRESENT or ABSENT)
  async updateAttendance(adminId, userId, payload) {
    try {
      const date = moment().format("YYYY-MM-DD");
      const type = payload.type || "present";

      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
      });
      if (!user) throw new Error("User not found");

      const [record] = await Attendance.findOrCreate({
        where: { userId, date },
        defaults: {
          type,
          lateMinutes: 0,
          extraMinutes: 0,
          isHalfDay: false,
          reason: null,
          notes: null,
        },
      });

      const updateData = {};

      if (type === "present") {
        updateData.type = "present";
        updateData.lateMinutes = payload.lateMinutes || 0;
        updateData.extraMinutes = payload.extraMinutes || 0;
        updateData.isHalfDay = payload.isHalfDay || false;
        updateData.reason = null;
      } else if (type === "absent") {
        updateData.type = "absent";
        updateData.reason = payload.reason || "absent";
        updateData.isHalfDay = payload.isHalfDay || false;
        updateData.notes = payload.notes || null;
        updateData.lateMinutes = 0;
        updateData.extraMinutes = 0;
      }

      await record.update(updateData);

      return {
        status: true,
        message: `Attendance updated: ${type.toUpperCase()}`,
        data: record,
      };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // DELETE ATTENDANCE (to undo)
  async deleteAttendance(adminId, userId, date) {
    try {
      const record = await Attendance.findOne({
        where: { userId, date },
      });
      if (!record) throw new Error("No attendance record found");

      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
      });
      if (!user) throw new Error("Unauthorized");

      await record.destroy();
      return { status: true, message: "Attendance removed" };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // Case 6: Create leave request (can be by admin or user, but assume admin for now)
  async createLeaveRequest(
    adminId,
    { userId, startDate, endDate, type, notes }
  ) {
    try {
      // Validate dates
      const start = moment(startDate, "YYYY-MM-DD");
      const end = moment(endDate, "YYYY-MM-DD");
      if (!start.isValid() || !end.isValid() || start > end) {
        throw new Error("Invalid dates");
      }

      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
      });
      if (!user) {
        throw new Error("User not found");
      }

      const leave = await LeaveRequest.create({
        userId,
        startDate,
        endDate,
        type,
        notes,
        status: "pending",
      });

      return { status: true, message: "Leave request created", data: leave };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // get full leave history
  async getLeaveHistory(adminId, query = {}) {
    try {
      const {
        page = 1,
        pageSize = 10,
        status,
        userId,
        startDate,
        endDate,
      } = query;

      // CRITICAL: Convert to numbers!
      const pageNum = Number(page) || 1;
      const pageSizeNum = Number(pageSize) || 10;
      const offset = (pageNum - 1) * pageSizeNum;

      const where = {};
      const userWhere = { parentUserId: adminId };

      if (userId) userWhere.id = Number(userId); // also convert
      if (status) where.status = status;
      if (startDate) where.startDate = { [Op.gte]: startDate };
      if (endDate) where.endDate = { [Op.lte]: endDate };

      const { count, rows } = await LeaveRequest.findAndCountAll({
        where,
        include: [
          {
            model: UserRole,
            as: "employee",
            where: userWhere,
            attributes: ["id", "fullName", "email", "role"],
          },
          {
            model: User,
            as: "approver",
            attributes: ["id", "fullName"],
            required: false,
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: pageSizeNum, // ← Number
        offset, // ← Number
      });

      const totalPages = Math.ceil(count / pageSizeNum);

      return {
        status: true,
        message: "Leave history fetched",
        data: {
          leaves: rows,
          pagination: {
            page: pageNum,
            pageSize: pageSizeNum,
            totalCount: count,
            totalPages,
            hasMore: pageNum < totalPages,
          },
        },
      };
    } catch (error) {
      console.error("LeaveHistory Error:", error); // ← Log for debugging
      return { status: false, message: error.message };
    }
  },

  // Case 6: Update leave status
  async updateLeaveStatus(adminId, leaveId, { status }) {
    try {
      const leave = await LeaveRequest.findByPk(leaveId);
      if (!leave) {
        throw new Error("Leave not found");
      }

      // Check user belongs to admin
      const user = await UserRole.findOne({
        where: { id: leave.userId, parentUserId: adminId },
      });
      if (!user) {
        throw new Error("Unauthorized");
      }

      await leave.update({ status, approvedBy: adminId });

      return { status: true, message: "Leave updated", data: leave };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // Case 7: Add holiday
  async addHoliday(adminId, { date, description }) {
    try {
      if (!moment(date, "YYYY-MM-DD", true).isValid()) {
        throw new Error("Invalid date");
      }

      // Assume adminId is super admin or manager, no check for now

      const holiday = await Holiday.create({ date, description });

      return { status: true, message: "Holiday added", data: holiday };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // Case 7: Get holidays
  async getHolidays({ startDate, endDate }) {
    try {
      const where = {};
      if (startDate && endDate) {
        where.date = { [Op.between]: [startDate, endDate] };
      }
      const holidays = await Holiday.findAll({ where });
      return { status: true, data: holidays };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // Case 8: Promotion API (separate for future months)
  async promoteUser(adminId, { userId, newSalary, startMonth }) {
    const transaction = await sequelize.transaction();
    try {
      // Validate startMonth 'YYYY-MM'
      const startDate = moment(startMonth + "-01", "YYYY-MM-DD");
      if (!startDate.isValid()) {
        throw new Error("Invalid start month");
      }

      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
      });
      if (!user) {
        throw new Error("User not found");
      }

      const currentSalary = user.baseSalary;
      let status = "initial";
      if (newSalary > currentSalary) {
        status = "promotion";
      } else if (newSalary < currentSalary) {
        status = "demotion";
      }

      // Add history
      await SalaryHistory.create(
        {
          userId,
          salary: newSalary,
          startDate: startDate.toDate(),
          status,
          previousSalary: currentSalary,
        },
        { transaction }
      );

      // Update current baseSalary only if startDate <= today
      if (startDate <= moment()) {
        await user.update({ baseSalary: newSalary }, { transaction });
      }

      await transaction.commit();
      return { status: true, message: "Salary updated for future" };
    } catch (error) {
      await transaction.rollback();
      return { status: false, message: error.message };
    }
  },

  async getPromotionHistory(userId) {
    try {
      const history = await SalaryHistory.findAll({
        where: { userId },
        order: [["startDate", "DESC"]],
        attributes: [
          "id",
          "salary",
          "previousSalary",
          "status",
          "startDate",
          "createdAt",
        ],
        include: [
          {
            model: UserRole,
            as: "userRole",
            attributes: ["id", "fullName", "email", "role", "baseSalary"],
          },
        ],
      });

      return {
        status: true,
        message: "Promotion history fetched",
        data: { userId, history },
      };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  async getAllPromotionHistory(query = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        userId,
        status,
        startDate,
        endDate,
      } = query;

      const pageNum = Number(page) || 1;
      const pageSizeNum = Number(pageSize) || 20;
      const offset = (pageNum - 1) * pageSizeNum;

      const where = {};
      if (userId) where.userId = Number(userId);
      if (status) where.status = status;
      if (startDate) where.startDate = { [Op.gte]: startDate };
      if (endDate) where.startDate = { [Op.lte]: endDate };

      const { count, rows } = await SalaryHistory.findAndCountAll({
        where,
        include: [
          {
            model: UserRole,
            as: "UserRole",
            attributes: ["id", "fullName", "email", "role", "baseSalary"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: pageSizeNum,
        offset,
      });

      const totalPages = Math.ceil(count / pageSizeNum);

      return {
        status: true,
        message: "All promotion history fetched",
        data: {
          history: rows,
          pagination: {
            page: pageNum,
            pageSize: pageSizeNum,
            totalCount: count,
            totalPages,
            hasMore: pageNum < totalPages,
          },
        },
      };
    } catch (error) {
      console.error("getAllPromotionHistory error:", error);
      return { status: false, message: error.message };
    }
  },

  // Case 5,6: Get salary details for month (preview)
  async getSalaryDetails(adminId, userId, month) {
    try {
      const startDate = moment(month + "-01", "YYYY-MM-DD");
      const endDate = startDate.clone().endOf("month");
      if (!startDate.isValid()) throw new Error("Invalid month");

      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
      });
      if (!user || !user.requiredDailyHours)
        throw new Error("User not found or incomplete");

      const [holidays, leaves, attendances, salaryHistories] =
        await Promise.all([
          Holiday.findAll({
            where: {
              date: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
            },
          }),
          LeaveRequest.findAll({ where: { userId, status: "approved" } }),
          Attendance.findAll({
            where: {
              userId,
              date: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
            },
          }),
          SalaryHistory.findAll({
            where: { userId },
            order: [["startDate", "ASC"]],
          }),
        ]);

      const holidayDates = holidays.map((h) =>
        moment(h.date).format("YYYY-MM-DD")
      );
      const leaveDays = new Set();
      leaves.forEach((leave) => {
        let d = moment(leave.startDate);
        while (d <= moment(leave.endDate)) {
          leaveDays.add(d.format("YYYY-MM-DD"));
          d.add(1, "day");
        }
      });

      const attendanceMap = {};
      attendances.forEach((att) => {
        attendanceMap[moment(att.date).format("YYYY-MM-DD")] = att;
      });

      let totalLateMin = 0,
        totalExtraMin = 0,
        totalAbsentDays = 0,
        totalPresentDays = 0,
        totalHalfDays = 0;
      let netPay = 0;

      let current = startDate.clone();
      while (current <= endDate) {
        const dayStr = current.format("YYYY-MM-DD");
        const isWeekend = [0, 6].includes(current.day());
        const isHoliday = holidayDates.includes(dayStr);
        const isLeave = leaveDays.has(dayStr);
        const att = attendanceMap[dayStr];

        // Effective salary
        let daySalary = user.baseSalary;
        for (let i = salaryHistories.length - 1; i >= 0; i--) {
          if (moment(salaryHistories[i].startDate) <= current) {
            daySalary = salaryHistories[i].salary;
            break;
          }
        }
        const dailyRate = daySalary / endDate.date();
        const hourlyRate = dailyRate / user.requiredDailyHours;
        const overtimeRate = hourlyRate * 1.5;

        if (isWeekend || isHoliday || isLeave) {
          if (att?.type === "present" && att.extraMinutes > 0) {
            netPay += (att.extraMinutes / 60) * overtimeRate;
            totalExtraMin += att.extraMinutes;
          }
          // No deduction
        } else {
          if (att) {
            if (att.type === "absent") {
              totalAbsentDays++;
              if (!att.isHalfDay) netPay -= dailyRate;
              else {
                totalHalfDays++;
                netPay -= dailyRate / 2;
              }
            } else if (att.type === "present") {
              let pay = dailyRate;
              if (att.isHalfDay) {
                totalHalfDays++;
                pay = dailyRate / 2;
              } else {
                totalPresentDays++;
              }
              pay -= (att.lateMinutes / 60) * hourlyRate;
              pay += (att.extraMinutes / 60) * overtimeRate;
              netPay += pay;

              totalLateMin += att.lateMinutes;
              totalExtraMin += att.extraMinutes;
            }
          } else {
            totalAbsentDays++;
          }
        }

        current.add(1, "day");
      }

      const details = {
        baseSalary: user.baseSalary,
        totalLateMin,
        totalExtraMin,
        totalAbsentDays,
        totalPresentDays,
        totalHalfDays,
        netPay: Math.max(0, netPay),
        expectedWorkingDays: 0, // can calculate
      };

      return { status: true, message: "Salary calculated", data: details };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // Extra: Release salary, save history (case 5,8)
  async releaseSalary(adminId, userId, month, releasedAmount, details) {
    try {
      // Validate
      const existing = await PayrollRelease.findOne({
        where: { userId, month },
      });
      if (existing) {
        throw new Error("Already released for this month");
      }

      const release = await PayrollRelease.create({
        userId,
        month,
        releasedAmount,
        details,
        releaseDate: new Date(),
        releasedBy: adminId,
      });

      return { status: true, message: "Salary released", data: release };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // NEW: Full release history (admin view)
  async getFullReleaseHistory(query = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        userId,
        month,
        startDate,
        endDate,
      } = query;

      const pageNum = Number(page) || 1;
      const pageSizeNum = Number(pageSize) || 20;
      const offset = (pageNum - 1) * pageSizeNum;

      const where = {};
      if (userId) where.userId = Number(userId);
      if (month) where.month = month;

      if (startDate || endDate) {
        where.releaseDate = {};
        if (startDate) where.releaseDate[Op.gte] = startDate;
        if (endDate) where.releaseDate[Op.lte] = endDate;
      }

      const { count, rows } = await PayrollRelease.findAndCountAll({
        where,
        include: [
          {
            model: UserRole,
            as: "UserRole",
            attributes: ["id", "fullName", "email", "role"],
          },
          {
            model: User,
            as: "releaser",
            attributes: ["id", "fullName"],
          },
        ],
        order: [["releaseDate", "DESC"]],
        limit: pageSizeNum,
        offset,
      });

      const totalPages = Math.ceil(count / pageSizeNum);

      return {
        status: true,
        message: "Full release history fetched",
        data: {
          history: rows,
          pagination: {
            page: pageNum,
            pageSize: pageSizeNum,
            totalCount: count,
            totalPages,
            hasMore: pageNum < totalPages,
          },
        },
      };
    } catch (error) {
      console.error("getFullReleaseHistory error:", error);
      return { status: false, message: error.message };
    }
  },

  // Existing: Get single user history
  async getReleaseHistory(userId) {
    try {
      const history = await PayrollRelease.findAll({
        where: { userId },
        include: [
          {
            model: UserRole,
            as: "UserRole",
            attributes: ["fullName", "email"],
          },
          { model: User, as: "releaser", attributes: ["fullName"] },
        ],
        order: [["month", "DESC"]],
      });
      return { status: true, data: history };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },
};

module.exports = PayrollService;
