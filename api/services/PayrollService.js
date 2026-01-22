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
  StuffCommission,
  EmployeeLoan,
  LoanPayment,
  AdvanceSalary, // Added
  PayrollFine,   // Added
} = require("../entity");

const PayrollService = {
  // Case 4: Mark multiple users present for a date
  // Case 4: Mark multiple users present for today's date

  async markMultiplePresent(accessibleShopIds, { userIds }) {
    const transaction = await sequelize.transaction();
    let result;

    try {
      const date = moment().format("YYYY-MM-DD");

      // Validate users
      const users = await UserRole.findAll({
        where: { id: { [Op.in]: userIds }, parentUserId: { [Op.in]: accessibleShopIds } },
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
    accessibleShopIds,
    { userIds, reason, isHalfDay = false, notes = "" }
  ) {
    const transaction = await sequelize.transaction();
    let result;

    try {
      const date = moment().format("YYYY-MM-DD");

      const users = await UserRole.findAll({
        where: {
          id: { [Op.in]: userIds }, parentUserId: { [Op.in]: accessibleShopIds }
        },
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
  async updateAttendance(accessibleShopIds, userId, payload) {
    try {
      const date = moment().format("YYYY-MM-DD");
      const type = payload.type || "present";

      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: { [Op.in]: accessibleShopIds } },
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

      return { status: true, message: `Attendance updated: ${type.toUpperCase()}`, data: record };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // DELETE ATTENDANCE (to undo)
  async deleteAttendance(accessibleShopIds, userId, date) {
    try {
      const record = await Attendance.findOne({
        where: { userId, date },
      });
      if (!record) throw new Error("No attendance record found");

      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: { [Op.in]: accessibleShopIds } },
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
    accessibleShopIds,
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
        where: {
          id: userId, parentUserId: { [Op.in]: accessibleShopIds }
        },
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
  async getLeaveHistory(accessibleShopIds, query = {}) {
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
      const userWhere = { parentUserId: { [Op.in]: accessibleShopIds } };

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
      console.error("LeaveHistory Error:", error);
      return { status: false, message: error.message };
    }
  },

  // Case 6: Update leave status
  async updateLeaveStatus(accessibleShopIds, adminId, leaveId, { status }) {
    try {
      const leave = await LeaveRequest.findByPk(leaveId);

      if (!leave) {
        throw new Error("Leave not found");
      }

      // Check user belongs to admin
      const user = await UserRole.findOne({
        where: { id: leave.userId, parentUserId: { [Op.in]: accessibleShopIds } },
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
  async addHoliday(adminId, { startDate, endDate, description }) {
    try {
      const start = moment(startDate, "YYYY-MM-DD", true);
      const end = moment(endDate, "YYYY-MM-DD", true);

      if (!start.isValid() || !end.isValid()) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
      }
      if (start.isAfter(end)) {
        throw new Error("endDate cannot be before startDate");
      }

      const holiday = await Holiday.create({
        startDate: start.format("YYYY-MM-DD"),
        endDate: end.format("YYYY-MM-DD"),
        description: description.trim(),
        createdBy: adminId, // this admin added = approved
      });

      return { status: true, message: "Holiday added successfully", data: holiday };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // Case 7: Get holidays
  async getHolidays(query = {}) {
    try {
      const {
        page = 1,
        pageSize = 10,
        startDate,
        endDate,
        year, // extra useful filter for BD companies
      } = query;

      // CRITICAL: Always convert to numbers
      const pageNum = Math.max(1, Number(page) || 1);
      const pageSizeNum = Math.min(100, Math.max(1, Number(pageSize) || 10)); // limit max 100
      const offset = (pageNum - 1) * pageSizeNum;

      const where = {};

      // Date range filter (on startDate or endDate overlapping)
      if (startDate || endDate) {
        where[Op.or] = [];
        if (startDate) {
          where[Op.or].push({ startDate: { [Op.gte]: startDate } });
          where[Op.or].push({ endDate: { [Op.gte]: startDate } });
        }
        if (endDate) {
          where[Op.or].push({ startDate: { [Op.lte]: endDate } });
          where[Op.or].push({ endDate: { [Op.lte]: endDate } });
        }
      }

      // Year filter (very common in Bangladesh)
      if (year) {
        const yearInt = Number(year);
        if (!isNaN(yearInt)) {
          where.startDate = {
            [Op.gte]: `${yearInt}-01-01`,
            [Op.lte]: `${yearInt}-12-31`,
          };
        }
      }

      const { count, rows } = await Holiday.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: "creator",
            attributes: ["id", "fullName", "email"], // or just "name" if you use that
            required: true,
          },
        ],
        order: [["startDate", "DESC"]],
        limit: pageSizeNum,
        offset,
        attributes: ["id", "startDate", "endDate", "description", "createdAt"],
      });

      const totalPages = Math.ceil(count / pageSizeNum);

      return { status: true, message: "Holidays fetched successfully", data: { holidays: rows, pagination: { page: pageNum, pageSize: pageSizeNum, totalCount: count, totalPages, hasMore: pageNum < totalPages, }, }, };
    } catch (error) {
      console.error("GetHolidays Error:", error);
      return { status: false, message: error.message };
    }
  },

  // Case 8: Promotion API (separate for future months)
  async promoteUser(accessibleShopIds, { userId, newSalary, startMonth }) {
    const transaction = await sequelize.transaction();
    try {
      // Validate startMonth 'YYYY-MM'
      const startDate = moment(startMonth + "-01", "YYYY-MM-DD");
      if (!startDate.isValid()) {
        throw new Error("Invalid start month");
      }

      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: { [Op.in]: accessibleShopIds } },
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

      return { status: true, message: "Promotion history fetched", data: { userId, history }, };
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

      return { status: true, message: "All promotion history fetched", data: { history: rows, pagination: { page: pageNum, pageSize: pageSizeNum, totalCount: count, totalPages, hasMore: pageNum < totalPages, }, }, };
    } catch (error) {
      console.error("getAllPromotionHistory error:", error);
      return { status: false, message: error.message };
    }
  },

  // ============================================
  // COMPREHENSIVE PAYROLL CALCULATION SERVICE
  // Following the flowchart step by step
  // ============================================

  /**
   * Step 1: Fetch Employee Base Salary
   */
  async fetchEmployeeBaseSalary(accessibleShopIds, userId) {
    const user = await UserRole.findOne({
      where: {
        id: userId, parentUserId:
          { [Op.in]: accessibleShopIds }
      },
      attributes: ["id", "fullName", "baseSalary", "requiredDailyHours", "salaryFrequency", "salaryStartDate"],
    });

    if (!user) {
      throw new Error("Employee not found");
    }

    // Check if salaryStartDate is set
    if (!user.salaryStartDate) {
      throw new Error("Employee salary start date is not set. Please set the salary start date before generating payroll or advance salary.");
    }

    const baseSalary = parseFloat(user.baseSalary || 0);
    if (!baseSalary || baseSalary <= 0) {
      throw new Error("Employee base salary not configured");
    }

    return {
      userId: user.id,
      fullName: user.fullName,
      baseSalary,
      salaryFrequency: user.salaryFrequency || "monthly",
      requiredDailyHours: user.requiredDailyHours,
      salaryStartDate: user.salaryStartDate,
    };
  },

  /**
   * Step 2: Calculate Outstanding Advance Salary
   * Outstanding Advance = Total Advance Taken - Total Advance Repaid
   */
  async calculateOutstandingAdvance(userId, salaryMonth) {
    // Fetch all approved advance salaries (taken)
    const advanceSalaries = await AdvanceSalary.findAll({
      where: {
        userId,
        status: { [Op.or]: ["APPROVED", "PARTIALLY_REPAID"] },
      },
      attributes: ["id", "amount", "salaryMonth", "repaidAmount"],
    });

    // Calculate total advance taken
    const totalAdvanceTaken = advanceSalaries.reduce(
      (sum, adv) => sum + parseFloat(adv.amount || 0),
      0
    );

    // Calculate total advance repaid (from payroll releases)
    const totalAdvanceRepaid = advanceSalaries.reduce(
      (sum, advance) => {
        return sum + parseFloat(advance.repaidAmount || 0);
      },
      0
    );

    // Outstanding advance = Taken - Repaid
    const outstandingAdvance = Math.max(0, totalAdvanceTaken - totalAdvanceRepaid);

    // Get advance for current month
    const currentMonthAdvance = advanceSalaries
      .filter((adv) => adv.salaryMonth === salaryMonth)
      .reduce((sum, adv) => sum + parseFloat(adv.amount || 0), 0);

    return {
      totalAdvanceTaken,
      totalAdvanceRepaid,
      outstandingAdvance,
      currentMonthAdvance,
      advanceRecords: advanceSalaries,
    };
  },

  /**
   * Step 3: Calculate Attendance Records (Simplified - Days Only)
   * - Total Working Days
   * - Paid Leave Days (Full Day & Half Day)
   * - Unpaid Leave Days (Full Day & Half Day)
   * - Salary Deduction for Unpaid Leave
   */
  async calculateAttendanceDetails(userId, salaryMonth) {
    const monthStart = moment(salaryMonth, "YYYY-MM").startOf("month");
    const monthEnd = moment(salaryMonth, "YYYY-MM").endOf("month");
    const startDate = monthStart.format("YYYY-MM-DD");
    const endDate = monthEnd.format("YYYY-MM-DD");

    const weekendDays = process.env.WEEKEND_DAYS
      ? process.env.WEEKEND_DAYS.split(",").map(Number)
      : []; // Friday & Saturday

    // Fetch holidays, approved leaves, and attendance records
    const [holidays, approvedLeaves, attendances] = await Promise.all([
      Holiday.findAll({
        where: {
          startDate: { [Op.lte]: endDate },
          endDate: { [Op.gte]: startDate },
        },
      }),
      LeaveRequest.findAll({
        where: {
          userId,
          status: "approved",
          startDate: { [Op.lte]: endDate },
          endDate: { [Op.gte]: startDate },
        },
      }),
      Attendance.findAll({
        where: {
          userId,
          date: { [Op.gte]: startDate, [Op.lte]: endDate },
        },
        attributes: ["date", "type", "isHalfDay"],
        raw: true,
      }),
    ]);


    // Build holiday & leave date sets
    const holidayDates = new Set();
    holidays.forEach((h) => {
      let d = moment(h.startDate);
      const e = moment(h.endDate);
      while (d <= e) {
        holidayDates.add(d.format("YYYY-MM-DD"));
        d.add(1, "day");
      }
    });

    const paidLeaveDates = new Set();
    approvedLeaves.forEach((leave) => {
      let d = moment(leave.startDate);
      const e = moment(leave.endDate);
      while (d <= e) {
        paidLeaveDates.add(d.format("YYYY-MM-DD"));
        d.add(1, "day");
      }
    });

    // Attendance map
    const attendanceMap = {};
    attendances.forEach((att) => {
      attendanceMap[att.date] = att;
    });

    // Counters
    let totalWorkingDays = 0;
    let totalWeekendDays = 0;
    let totalHolidayDays = 0;

    // Paid Leave Counters
    let paidLeaveFullDays = 0;
    let paidLeaveHalfDays = 0;

    // Unpaid Leave Counters
    let unpaidLeaveFullDays = 0;
    let unpaidLeaveHalfDays = 0;

    // Loop through each day of the month
    let currentDateStr = startDate;
    while (currentDateStr <= endDate) {
      const dayOfWeek = moment(currentDateStr).day();

      // Skip weekends
      if (weekendDays.includes(dayOfWeek)) {
        totalWeekendDays++;
        currentDateStr = moment(currentDateStr).add(1, "day").format("YYYY-MM-DD");
        continue;
      }

      // Count working days
      totalWorkingDays++;

      // Check if it's a holiday
      if (holidayDates.has(currentDateStr)) {
        totalHolidayDays++;
        currentDateStr = moment(currentDateStr).add(1, "day").format("YYYY-MM-DD");
        continue;
      }

      // Check attendance
      const att = attendanceMap[currentDateStr];
      const isPaidLeave = paidLeaveDates.has(currentDateStr);

      if (att) {
        if (att.type === "absent") {
          // Absent day - check if it's half day or full day
          // isHalfDay: 0/false = Full day absent, isHalfDay: 1/true = Half day absent
          const isHalfDayAbsent = Boolean(att.isHalfDay);

          if (isPaidLeave) {
            // Paid leave (from approved LeaveRequest)
            if (isHalfDayAbsent) {
              paidLeaveHalfDays += 0.5;
            } else {
              paidLeaveFullDays += 1;
            }
          } else {
            // Unpaid leave (absent without approved leave)
            if (isHalfDayAbsent) {
              unpaidLeaveHalfDays += 0.5;
            } else {
              unpaidLeaveFullDays += 1;
            }
          }
        } else if (att.type === "present") {
          // Present - check if it's half day present
          // If half day present, the other half is considered unpaid leave
          const isHalfDayPresent = Boolean(att.isHalfDay);

          if (isHalfDayPresent) {
            // Half day present means half day absent
            if (isPaidLeave) {
              paidLeaveHalfDays += 0.5;
            } else {
              unpaidLeaveHalfDays += 0.5;
            }
          }
          // If full day present (isHalfDay: 0/false), no deduction needed
        }
      } else {
        // No attendance record - assume present (full day)
      }

      // Next day
      currentDateStr = moment(currentDateStr).add(1, "day").format("YYYY-MM-DD");
    }

    // Calculate totals
    const totalPaidLeaveDays = paidLeaveFullDays + paidLeaveHalfDays;
    const totalUnpaidLeaveDays = unpaidLeaveFullDays + unpaidLeaveHalfDays;
    const totalLeaveDays = totalPaidLeaveDays + totalUnpaidLeaveDays;

    // Calculate unpaid leave deduction ratio (based on days)
    // Each full day = 1 day deduction, each half day = 0.5 day deduction
    const unpaidLeaveDeductionRatio = totalWorkingDays > 0
      ? (totalUnpaidLeaveDays / totalWorkingDays)
      : 0;

    return {
      totalWorkingDays,
      totalWeekendDays,
      totalHolidayDays,
      // Paid Leave Breakdown
      paidLeaveFullDays,
      paidLeaveHalfDays,
      totalPaidLeaveDays,
      // Unpaid Leave Breakdown
      unpaidLeaveFullDays,
      unpaidLeaveHalfDays,
      totalUnpaidLeaveDays,
      // Total Leave
      totalLeaveDays,
      // Deduction ratio (0-1) for calculating salary deduction
      unpaidLeaveDeductionRatio,
    };
  },

  /**
   * Step 4: Calculate Sales & Commission Data
   */
  async calculateSalesAndCommission(userId, salaryMonth) {
    const monthStart = moment(salaryMonth, "YYYY-MM").startOf("month");
    const monthEnd = moment(salaryMonth, "YYYY-MM").endOf("month");

    // Fetch commission records for the month
    const commissions = await StuffCommission.findAll({
      where: {
        UserRoleId: userId,
        createdAt: {
          [Op.gte]: monthStart.toDate(),
          [Op.lte]: monthEnd.toDate(),
        },
      },
      attributes: ["baseAmount", "commissionAmount", "commissionPercentage"],
    });

    // Calculate total sales and commission
    const totalSales = commissions.reduce(
      (sum, comm) => sum + parseFloat(comm.baseAmount || 0),
      0
    );

    const totalCommission = commissions.reduce(
      (sum, comm) => sum + parseFloat(comm.commissionAmount || 0),
      0
    );

    return {
      totalSales,
      totalCommission,
      commissionRecords: commissions,
    };
  },

  /**
   * Step 5: Calculate Gross Salary with Additions
   * Gross Salary = Base Salary + Commission + Bonus
   */
  calculateGrossSalary(baseSalary, commission, bonus = 0) {
    return parseFloat(baseSalary) + parseFloat(commission) + parseFloat(bonus);
  },

  /**
   * Step 6: Apply Advance Deduction Rule
   * Rule: Full Deduction / Partial Deduction / No Deduction
   */
  calculateAdvanceDeduction(outstandingAdvance, netSalary, deductionRule = "FULL") {
    let advanceDeduction = 0;
    let remainingAdvance = outstandingAdvance;

    switch (deductionRule.toUpperCase()) {
      case "FULL":
        // Deduct full outstanding advance
        advanceDeduction = Math.min(outstandingAdvance, netSalary);
        remainingAdvance = Math.max(0, outstandingAdvance - advanceDeduction);
        break;

      case "PARTIAL":
        // Deduct partial amount (50% of outstanding or net salary, whichever is less)
        const partialAmount = Math.min(outstandingAdvance * 0.5, netSalary);
        advanceDeduction = Math.min(partialAmount, netSalary);
        remainingAdvance = Math.max(0, outstandingAdvance - advanceDeduction);
        break;

      case "NONE":
      default:
        // No deduction this cycle
        advanceDeduction = 0;
        remainingAdvance = outstandingAdvance;
        break;
    }

    return {
      advanceDeduction,
      remainingAdvance,
    };
  },

  /**
   * REUSABLE: Calculate Previous Months' Unpaid Dues
   * Returns total previous dues and breakdown
   */
  async calculatePreviousDues(userId, beforeMonth) {
    const previousPayrolls = await PayrollRelease.findAll({
      where: {
        userId,
        salaryMonth: {
          [Op.lt]: beforeMonth, // All months before the specified month
        },
      },
      attributes: ["id", "salaryMonth", "netPayableSalary", "paidAmount"],
      order: [["salaryMonth", "ASC"]],
    });

    let totalPreviousDues = 0;
    const previousDuesBreakdown = [];

    for (const payroll of previousPayrolls) {
      const netPayable = parseFloat(payroll.netPayableSalary || 0);
      const paid = parseFloat(payroll.paidAmount || 0);
      const due = netPayable - paid;

      if (due > 0.01) {
        // Has outstanding dues
        totalPreviousDues += due;
        previousDuesBreakdown.push({
          salaryMonth: payroll.salaryMonth,
          netPayable,
          paid,
          due: Number(due.toFixed(2)),
        });
      }
    }

    return {
      totalPreviousDues: Number(totalPreviousDues.toFixed(2)),
      previousDuesBreakdown,
      hasPreviousDues: totalPreviousDues > 0.01,
    };
  },

  /**
   * Helper: Calculate Salary Based on Frequency
   * @param {string} salaryFrequency - 'daily', 'weekly', or 'monthly'
   * @param {number} baseSalary - The base salary amount (daily rate for daily, weekly rate for weekly, monthly for monthly)
   * @param {string} salaryMonth - The salary month in YYYY-MM format
   * @param {number} userId - User ID
   * @param {Date} salaryStartDate - Employee salary start date (if null, salary cannot be calculated)
   * @returns {object} - Calculated salary details
   */
  async calculateSalaryByFrequency(salaryFrequency, baseSalary, salaryMonth, userId, salaryStartDate) {
    const monthStart = moment(salaryMonth, "YYYY-MM").startOf("month").startOf("day");
    const monthEnd = moment(salaryMonth, "YYYY-MM").endOf("month").startOf("day");
    const totalDaysInMonth = monthEnd.date();

    // Determine payroll start date (either month start or salary start date, whichever is later)
    // Use UTC to avoid timezone conversion issues (e.g., 2026-01-01T19:06:05.000Z should be 2026-01-01, not 2026-01-02)
    const payrollStartDate = salaryStartDate
      ? moment.max(monthStart, moment.utc(salaryStartDate).startOf("day"))
      : monthStart;

    console.log({ payrollStartDate, monthStart, salaryStartDate, salaryStartMonth: salaryStartDate ? moment.utc(salaryStartDate).format("YYYY-MM-DD") : null })
    // If month end is greater than current date, use current date; otherwise use month end
    const currentDate = moment().endOf("day");
    const payrollEndDate = monthEnd.isAfter(currentDate) ? currentDate : monthEnd;

    let effectiveBaseSalary = baseSalary;
    let calculationMethod = "";
    let calculationDetails = {};

    const weekendDays = process.env.WEEKEND_DAYS
      ? process.env.WEEKEND_DAYS.split(",").map(Number)
      : [];

    if (salaryFrequency === "daily") {
      // Daily salary calculation
      // baseSalary is the per-day rate
      // Count total working days from payroll start to payroll end

      let workingDays = 0;
      let currentDate = payrollStartDate.clone();

      while (currentDate.isSameOrBefore(payrollEndDate)) {
        const dayOfWeek = currentDate.day();

        // Count only non-weekend days
        if (!weekendDays.includes(dayOfWeek)) {
          workingDays++;
        }

        currentDate.add(1, "day");
      }

      // Calculate salary: daily rate × working days
      effectiveBaseSalary = Math.round(baseSalary * workingDays);

      calculationMethod = "daily";
      calculationDetails = {
        dailyRate: Number(baseSalary.toFixed(2)),
        payrollStartDate: payrollStartDate.format("YYYY-MM-DD"),
        payrollEndDate: payrollEndDate.format("YYYY-MM-DD"),
        totalDaysInMonth,
        workingDays,
        calculatedSalary: effectiveBaseSalary,
      };
    } else if (salaryFrequency === "weekly") {
      // Weekly salary calculation
      // baseSalary is the per-week rate (Saturday to Friday)
      // Pay only for fully completed weeks, no pro-rating for partial weeks

      // Find the first Saturday on or after payroll start date
      let weekStart = payrollStartDate.clone();
      while (weekStart.day() !== 6) { // 6 = Saturday
        weekStart.add(1, "day");
      }

      let completeWeeks = 0;
      let partialDays = 0;
      const weekDetails = [];

      // Count complete weeks
      let currentWeekStart = weekStart.clone();

      while (currentWeekStart.isSameOrBefore(payrollEndDate)) {
        const currentWeekEnd = currentWeekStart.clone().add(6, "days"); // Friday

        // Check if this is a complete week within the payroll period
        if (currentWeekEnd.isSameOrBefore(payrollEndDate)) {
          // This is a complete week
          completeWeeks++;
          weekDetails.push({
            weekNumber: completeWeeks,
            startDate: currentWeekStart.format("YYYY-MM-DD"),
            endDate: currentWeekEnd.format("YYYY-MM-DD"),
            status: "complete",
          });
        } else {
          // This is a partial week - count remaining days but don't pay
          let remainingDays = 0;
          let d = currentWeekStart.clone();

          while (d.isSameOrBefore(payrollEndDate)) {
            const dayOfWeek = d.day();
            if (!weekendDays.includes(dayOfWeek)) {
              remainingDays++;
            }
            d.add(1, "day");
          }

          partialDays = remainingDays;

          if (remainingDays > 0) {
            weekDetails.push({
              weekNumber: completeWeeks + 1,
              startDate: currentWeekStart.format("YYYY-MM-DD"),
              endDate: payrollEndDate.format("YYYY-MM-DD"),
              status: "partial",
              remainingDays,
              note: "Carried to next payroll period",
            });
          }
        }

        currentWeekStart.add(7, "days"); // Move to next Saturday
      }

      // Count days before first complete week (if payroll doesn't start on Saturday)
      let daysBeforeFirstWeek = 0;
      if (payrollStartDate.isBefore(weekStart)) {
        let d = payrollStartDate.clone();
        while (d.isBefore(weekStart)) {
          const dayOfWeek = d.day();
          if (!weekendDays.includes(dayOfWeek)) {
            daysBeforeFirstWeek++;
          }
          d.add(1, "day");
        }
      }

      // Calculate salary: weekly rate × complete weeks only
      effectiveBaseSalary = Math.round(baseSalary * completeWeeks);

      calculationMethod = "weekly";
      calculationDetails = {
        weeklyRate: Number(baseSalary.toFixed(2)),
        payrollStartDate: payrollStartDate.format("YYYY-MM-DD"),
        payrollEndDate: payrollEndDate.format("YYYY-MM-DD"),
        firstWeekStartDate: weekStart.format("YYYY-MM-DD"),
        completeWeeks,
        daysBeforeFirstWeek,
        partialWeekDays: partialDays,
        weekDetails,
        calculatedSalary: effectiveBaseSalary,
        note: partialDays > 0
          ? `${partialDays} day(s) from partial week will be carried to next payroll period`
          : daysBeforeFirstWeek > 0
            ? `${daysBeforeFirstWeek} day(s) before first complete week are not paid`
            : null,
      };
    } else {
      // Monthly salary (default)
      // baseSalary is the fixed monthly amount
      // No day or week calculation required
      effectiveBaseSalary = baseSalary;
      calculationMethod = "monthly";
      calculationDetails = {
        monthlyRate: baseSalary,
        payrollStartDate: payrollStartDate.format("YYYY-MM-DD"),
        payrollEndDate: payrollEndDate.format("YYYY-MM-DD"),
        note: "Fixed monthly salary",
      };
    }

    return {
      effectiveBaseSalary,
      calculationMethod,
      calculationDetails,
    };
  },

  /**
   * MAIN PAYROLL CALCULATION FUNCTION
   * Follows the complete flowchart
   */
  async calculateMonthlyPayrollDetails(accessibleShopIds, userId, salaryMonth, options = {}) {
    try {
      // Validate salaryMonth format
      const monthStart = moment(salaryMonth, "YYYY-MM");
      if (!monthStart.isValid()) {
        throw new Error("Invalid salaryMonth format. Use YYYY-MM.");
      }

      // Step 1: Fetch Employee Base Salary and Joining Date
      const employee = await this.fetchEmployeeBaseSalary(accessibleShopIds, userId);
      const { baseSalary, salaryFrequency } = employee;

      // Get employee's full details to check joining date
      const userDetails = await UserRole.findOne({
        where: { id: userId },
        attributes: ["id", "fullName", "createdAt"],
      });

      if (!userDetails) {
        throw new Error("User not found");
      }

      // Get joining month in YYYY-MM format
      const joiningMonth = moment(userDetails.createdAt).format("YYYY-MM");

      // Validate: Cannot calculate payroll for months before joining
      if (salaryMonth < joiningMonth) {
        throw new Error(
          `Cannot calculate payroll for ${salaryMonth}. Employee joined in ${joiningMonth}.`
        );
      }

      // Step 2: Fetch Advance Salary Records & Calculate Outstanding
      const advanceData = await this.calculateOutstandingAdvance(userId, salaryMonth);

      console.log({ advanceData })

      // Step 3: Fetch Attendance Records & Calculate Deductions (Simplified - Days Only)
      const attendanceData = await this.calculateAttendanceDetails(userId, salaryMonth);

      // Calculate salary based on frequency (daily, weekly, or monthly)
      let effectiveBaseSalary = baseSalary;
      let salaryCalculationDetails = {};

      // Apply salary frequency calculation
      const joiningDate = userDetails.createdAt;

      if (salaryFrequency === "daily" || salaryFrequency === "weekly") {
        // For daily and weekly, use the new calculation method
        const salaryCalc = await this.calculateSalaryByFrequency(
          salaryFrequency,
          baseSalary,
          salaryMonth,
          userId,
          joiningDate
        );
        effectiveBaseSalary = salaryCalc.effectiveBaseSalary;
        salaryCalculationDetails = salaryCalc.calculationDetails;
      } else {
        // Monthly salary (default): Fixed amount
        effectiveBaseSalary = baseSalary;
        salaryCalculationDetails = {
          monthlyRate: baseSalary,
          payrollStartDate: moment.max(
            moment(salaryMonth, "YYYY-MM").startOf("month"),
            moment(joiningDate)
          ).format("YYYY-MM-DD"),
          payrollEndDate: moment(salaryMonth, "YYYY-MM").endOf("month").format("YYYY-MM-DD"),
          note: "Fixed monthly salary",
        };
      }

      // Step 4: Fetch Sales & Commission Data
      const commissionData = await this.calculateSalesAndCommission(userId, salaryMonth);

      // Step 5: Calculate Gross Salary (base salary + commission)
      const grossSalary = this.calculateGrossSalary(
        effectiveBaseSalary,
        commissionData.totalCommission,
        options.bonusAmount || 0
      );

      // Step 6: Calculate deductions
      // For all salary types, we need to deduct for absences
      let unpaidLeaveDeductionAmount = 0;
      let netAttendanceSalary = effectiveBaseSalary;

      // Calculate absence deduction based on unpaid leave
      if (attendanceData.totalUnpaidLeaveDays > 0) {
        // Calculate per-day deduction rate based on salary frequency
        let perDayRate = 0;

        if (salaryFrequency === "daily") {
          perDayRate = baseSalary; // baseSalary is already the daily rate
        } else if (salaryFrequency === "weekly") {
          perDayRate = baseSalary / 7; // weekly rate / 7 days
        } else {
          // Monthly: calculate based on working days in month
          perDayRate = attendanceData.totalWorkingDays > 0
            ? baseSalary / attendanceData.totalWorkingDays
            : 0;
        }

        unpaidLeaveDeductionAmount = Math.round(perDayRate * attendanceData.totalUnpaidLeaveDays);
        netAttendanceSalary = Math.max(0, effectiveBaseSalary - unpaidLeaveDeductionAmount);
      }

      const salaryAfterAttendance = Math.max(0, netAttendanceSalary);

      // Step 7: Fetch other deductions
      const [employeeLoan, payrollFines] = await Promise.all([
        EmployeeLoan.findOne({
          where: { employeeId: userId, status: "ACTIVE" },
          attributes: ["monthlyEMI", "remainingBalance"],
        }),
        PayrollFine.findAll({
          where: { userId, salaryMonth },
          attributes: ["amount"],
        }),
      ]);

      let loanDeduction = 0;
      if (employeeLoan && parseFloat(employeeLoan.remainingBalance) > 0) {
        loanDeduction = Math.min(
          parseFloat(employeeLoan.monthlyEMI),
          parseFloat(employeeLoan.remainingBalance)
        );
      }

      const totalFine = payrollFines.reduce(
        (sum, fine) => sum + parseFloat(fine.amount || 0),
        0
      );

      // Step 8: Calculate Overtime Amount (if provided in options)
      const overtimeAmount = options.overtimeAmount || 0;

      // Step 9: Calculate Previous Months' Unpaid Dues (using reusable function)
      const previousDuesData = await this.calculatePreviousDues(userId, salaryMonth);
      const totalPreviousDues = previousDuesData.totalPreviousDues;
      const previousDuesBreakdown = previousDuesData.previousDuesBreakdown;


      // Step 9.5: Check Current Month's Existing Payments
      // Fetch all existing payroll releases for the current month
      const currentMonthPayrolls = await PayrollRelease.findAll({
        where: {
          userId,
          salaryMonth: salaryMonth, // Current month only
        },
        attributes: ["id", "paidAmount", "createdAt"],
        order: [["createdAt", "ASC"]],
      });

      // Calculate total already paid in current month
      const currentMonthPaidAmount = currentMonthPayrolls.reduce(
        (sum, payroll) => sum + parseFloat(payroll.paidAmount || 0),
        0
      );

      const hasCurrentMonthPayments = currentMonthPayrolls.length > 0;

      // Step 10: Calculate Net Payable Salary (WITHOUT advance deduction)
      // Advance salary is only shown for information, not deducted here
      // Add previous dues to current month's net payable
      const currentMonthNetPayable = salaryAfterAttendance +
        commissionData.totalCommission +
        (options.bonusAmount || 0) +
        overtimeAmount -
        loanDeduction -
        totalFine -
        (options.otherDeduction || 0);

      // Total payable = current month + previous dues
      let totalPayable = currentMonthNetPayable + totalPreviousDues;

      // Remaining due = total payable - already paid in current month
      const currentMonthRemainingDue = totalPayable - currentMonthPaidAmount;

      // Net payable is the remaining amount to be paid
      const netPayableSalary = Math.max(0, currentMonthRemainingDue);

      // Step 11: Calculate current month advance (if any)
      const currentMonthAdvance = advanceData.currentMonthAdvance;

      // Build comprehensive response (Simplified)
      const data = {
        userId: employee.userId,
        fullName: employee.fullName,
        salaryMonth,
        baseSalary, // Original base salary (daily/weekly/monthly rate)
        effectiveBaseSalary, // Calculated base salary based on frequency
        salaryFrequency, // 'daily', 'weekly', or 'monthly'
        salaryCalculationDetails, // Details of how salary was calculated

        // Attendance Details (Days Only)
        totalWorkingDays: attendanceData.totalWorkingDays,
        totalWeekendDays: attendanceData.totalWeekendDays,
        totalHolidayDays: attendanceData.totalHolidayDays,

        // Paid Leave Breakdown
        paidLeaveFullDays: attendanceData.paidLeaveFullDays,
        paidLeaveHalfDays: attendanceData.paidLeaveHalfDays,
        totalPaidLeaveDays: attendanceData.totalPaidLeaveDays,

        // Unpaid Leave Breakdown
        unpaidLeaveFullDays: attendanceData.unpaidLeaveFullDays,
        unpaidLeaveHalfDays: attendanceData.unpaidLeaveHalfDays,
        totalUnpaidLeaveDays: attendanceData.totalUnpaidLeaveDays,

        // Total Leave
        totalLeaveDays: attendanceData.totalLeaveDays,

        // Salary Calculations
        grossSalary,
        netAttendanceSalary: salaryAfterAttendance,
        unpaidLeaveDeductionAmount: Number(unpaidLeaveDeductionAmount.toFixed(2)),
        bonusAmount: options.bonusAmount || 0,
        bonusDescription: options.bonusDescription || null,
        overtimeAmount: Number(overtimeAmount.toFixed(2)),

        // Deductions
        loanDeduction,
        fineAmount: totalFine,
        otherDeduction: options.otherDeduction || 0,

        // Advance Salary Information (for display only, not deducted)
        totalAdvanceTaken: advanceData.totalAdvanceTaken,
        totalAdvanceRepaid: advanceData.totalAdvanceRepaid,
        outstandingAdvance: advanceData.outstandingAdvance,
        currentMonthAdvance,

        // Previous Months' Dues Information
        totalPreviousDues: Number(totalPreviousDues.toFixed(2)),
        previousDuesBreakdown,
        hasPreviousDues: totalPreviousDues > 0.01,

        // Current Month Calculation (before adding previous dues)
        currentMonthNetPayable: Number(currentMonthNetPayable.toFixed(2)),

        // Current Month Payment Tracking
        currentMonthPaidAmount: Number(currentMonthPaidAmount.toFixed(2)),
        hasCurrentMonthPayments,
        currentMonthPaymentsCount: currentMonthPayrolls.length,

        // Total Payable (current month + previous dues)
        totalPayable: Number(totalPayable.toFixed(2)),

        // Remaining Due (total payable - already paid this month)
        currentMonthRemainingDue: Number(currentMonthRemainingDue.toFixed(2)),

        // Final Amount (remaining to be paid)
        netPayableSalary: Number(netPayableSalary.toFixed(2)),

        // Commission & Sales
        totalSales: commissionData.totalSales,
        totalCommission: commissionData.totalCommission,

        // Status
        status: "PENDING",
        releaseDate: null,
        releasedBy: null,

        // Calculation Snapshot
        calculationSnapshot: {
          advanceData,
          attendanceData,
          commissionData,
          previousDues: {
            total: Number(totalPreviousDues.toFixed(2)),
            breakdown: previousDuesBreakdown,
          },
          currentMonthPayments: {
            totalPaid: Number(currentMonthPaidAmount.toFixed(2)),
            paymentsCount: currentMonthPayrolls.length,
            hasPayments: hasCurrentMonthPayments,
          },
          paymentSummary: {
            currentMonthNetPayable: Number(currentMonthNetPayable.toFixed(2)),
            previousDues: Number(totalPreviousDues.toFixed(2)),
            totalPayable: Number(totalPayable.toFixed(2)),
            alreadyPaid: Number(currentMonthPaidAmount.toFixed(2)),
            remainingDue: Number(currentMonthRemainingDue.toFixed(2)),
          },
        },
      };

      return { status: true, message: "Payroll calculated successfully", data };
    } catch (error) {
      console.error("calculateMonthlyPayrollDetails error:", error);
      return { status: false, message: error.message };
    }
  },

  // \u2705 Payroll Monthly Auto Generator API
  async generateMonthlyPayroll(accessibleShopIds, { userId, salaryMonth }) {
    const transaction = await sequelize.transaction();
    try {
      // Prevent duplicate salary for same user + same month
      const existingPayroll = await PayrollRelease.findOne({
        where: { userId, salaryMonth },
        transaction,
      });

      if (existingPayroll) {
        throw new Error("Payroll already generated for this user and month.");
      }

      const salaryDetailsResult = await this.calculateMonthlyPayrollDetails(
        accessibleShopIds, // Convert to array for accessibleShopIds
        userId,
        salaryMonth,
        options
      );

      if (!salaryDetailsResult.status) {
        throw new Error(
          `Failed to calculate salary for employee ${userId}: ${salaryDetailsResult.message}`
        );
      }

      const calculationData = salaryDetailsResult.data;

      const payrollRelease = await PayrollRelease.create(
        {
          userId,
          salaryMonth,
          shopId: adminId,
          baseSalary: calculationData.baseSalary,
          advanceAmount: calculationData.advanceAmount,
          bonusAmount: calculationData.bonusAmount,
          bonusDescription: calculationData.bonusDescription,
          loanDeduction: calculationData.loanDeduction,
          fineAmount: calculationData.fineAmount,
          overtimeAmount: calculationData.overtimeAmount,
          otherDeduction: calculationData.otherDeduction,
          netPayableSalary: calculationData.netPayableSalary,
          status: "PENDING",
          releaseDate: null,
          releasedBy: null,
          calculationSnapshot: calculationData.calculationSnapshot,
        },
        { transaction }
      );

      await transaction.commit();
      return { status: true, message: "Monthly payroll generated successfully", data: payrollRelease };
    } catch (error) {
      await transaction.rollback();
      return { status: false, message: error.message };
    }
  },

  // \u2705 Salary Release API
  async releasePayroll(accessibleShopIds, adminId, payrollReleaseId, paymentType = "FULL", partialAmount = null) {
    const transaction = await sequelize.transaction();
    try {
      const payrollRelease = await PayrollRelease.findOne({
        where: { id: payrollReleaseId, shopId: { [Op.in]: accessibleShopIds } },
        transaction,
      });

      if (!payrollRelease) {
        throw new Error("Payroll record not found.");
      }

      if (payrollRelease.status === "RELEASED") {
        throw new Error("Payroll has already been released.");
      }

      // Handle payment type (Full or Partial)
      let actualPaidAmount = parseFloat(payrollRelease.netPayableSalary);
      if (paymentType === "PARTIAL" && partialAmount) {
        actualPaidAmount = Math.min(parseFloat(partialAmount), actualPaidAmount);
        if (actualPaidAmount <= 0) {
          throw new Error("Partial payment amount must be greater than 0");
        }
      }

      // Update loan outstanding balance if loan deduction was part of this payroll
      if (payrollRelease.loanDeduction > 0) {
        const employeeLoan = await EmployeeLoan.findOne({
          where: { employeeId: payrollRelease.userId, status: "ACTIVE" },
          transaction,
        });

        if (employeeLoan) {
          const newRemainingBalance = parseFloat(employeeLoan.remainingBalance) - parseFloat(payrollRelease.loanDeduction);
          await employeeLoan.update(
            {
              remainingBalance: newRemainingBalance,
              status: newRemainingBalance <= 0 ? "COMPLETED" : "ACTIVE",
            },
            { transaction }
          );
          await LoanPayment.create(
            {
              loanId: employeeLoan.id,
              employeeId: payrollRelease.userId,
              paidAmount: payrollRelease.loanDeduction,
              paidBy: adminId,
            },
            { transaction }
          );
        }
      }

      // Update advance salary records - mark as deducted
      const snapshot = payrollRelease.calculationSnapshot || {};
      if (payrollRelease.advanceAmount > 0) {
        snapshot.advanceRepaid = parseFloat(payrollRelease.advanceAmount);
        snapshot.outstandingAdvanceAfter = snapshot.advanceData?.outstandingAdvanceAfter || 0;
      }

      await payrollRelease.update(
        {
          status: "RELEASED",
          releaseDate: moment().toDate(),
          releasedBy: adminId,
          calculationSnapshot: {
            ...snapshot,
            paymentType,
            actualPaidAmount,
            releaseDate: moment().toDate(),
          },
        },
        { transaction }
      );

      await transaction.commit();
      return {
        status: true,
        message: `Payroll released successfully (${paymentType})`,
        data: {
          ...payrollRelease.toJSON(),
          actualPaidAmount,
          paymentType,
        },
      };
    } catch (error) {
      await transaction.rollback();
      return { status: false, message: error.message };
    }
  },

  /**
   * ✅ NEW: Release Payroll with Validation
   * This function validates the editable fields against calculated payroll details
   * and creates a new PayrollRelease record
   */
  async releasePayrollWithValidation(accessibleShopIds, adminId, payload) {
    const transaction = await sequelize.transaction();
    try {
      const {
        userId,
        salaryMonth,
        baseSalary,
        advanceAmount = 0,
        bonusAmount = 0,
        bonusDescription = null,
        loanDeduction = 0,
        fineAmount = 0,
        overtimeAmount = 0,
        otherDeduction = 0,
        netPayableSalary,
        paidAmount,
        shopId,
        calculationSnapshot,
      } = payload;

      // Validate required fields
      if (!userId || !salaryMonth || !shopId) {
        throw new Error("Missing required fields: userId, salaryMonth, or shopId");
      }

      // Check if payroll record already exists for this user and month
      const existingPayroll = await PayrollRelease.findOne({
        where: { userId, salaryMonth },
        transaction,
      });

      // Fetch user details to get joining date (using createdAt as joining date)
      const userDetails = await UserRole.findOne({
        where: { id: userId },
        attributes: ["id", "fullName", "createdAt"],
        transaction,
      });

      if (!userDetails) {
        throw new Error("User not found");
      }

      // Get joining month in YYYY-MM format
      const joiningMonth = moment(userDetails.createdAt).format("YYYY-MM");

      // Calculate previous months' dues using reusable function
      const previousDuesData = await this.calculatePreviousDues(userId, salaryMonth);
      const totalPreviousDues = previousDuesData.totalPreviousDues;
      const hasPreviousDues = previousDuesData.hasPreviousDues;

      // Payment Allocation: Pay previous PENDING dues first (FIFO), then current month
      let remainingPayment = parseFloat(paidAmount);
      let allocatedToPreviousDues = 0;
      let allocatedToCurrentMonth = 0;
      const previousDuesPayments = [];

      // Fetch all PENDING payrolls before current month (excluding joining month)
      const whereConditions = {
        userId,
        status: "PENDING",
        salaryMonth: {
          [Op.and]: [
            { [Op.lt]: salaryMonth },
            { [Op.gte]: joiningMonth }
          ]
        },
      };

      const pendingPreviousPayrolls = await PayrollRelease.findAll({
        where: whereConditions,
        order: [["salaryMonth", "ASC"]], // Oldest first (FIFO)
        transaction,
      });

      console.log({ pendingPreviousPayrolls, salaryMonth, joiningMonth, userId })

      // Allocate payment to previous PENDING payrolls first
      for (const payroll of pendingPreviousPayrolls) {
        if (remainingPayment <= 0) break;

        console.log({ payroll, remainingPayment })

        const netPayable = parseFloat(payroll.netPayableSalary || 0);
        const alreadyPaid = parseFloat(payroll.paidAmount || 0);
        const dueAmount = netPayable - alreadyPaid;

        if (dueAmount <= 0.01) continue; // Skip if already paid

        const paymentForThisMonth = Math.min(remainingPayment, dueAmount);
        const newPaidAmount = alreadyPaid + paymentForThisMonth;
        const newDueAmount = netPayable - newPaidAmount;

        // Determine if this payroll is now fully paid
        const isFullyPaid = newDueAmount <= 0.01;
        const newStatus = isFullyPaid ? "RELEASED" : "PENDING";

        allocatedToPreviousDues += paymentForThisMonth;
        remainingPayment -= paymentForThisMonth;

        previousDuesPayments.push({
          salaryMonth: payroll.salaryMonth,
          netPayable,
          previouslyPaid: alreadyPaid,
          paidAmount: paymentForThisMonth,
          newTotalPaid: newPaidAmount,
          remainingDue: newDueAmount,
          statusChanged: payroll.status !== newStatus,
          newStatus,
        });

        // Update the previous payroll record
        await payroll.update(
          {
            paidAmount: newPaidAmount,
            status: newStatus,
            releaseDate: isFullyPaid ? new Date() : payroll.releaseDate,
            releasedBy: isFullyPaid ? adminId : payroll.releasedBy,
          },
          { transaction }
        );
      }

      // Remaining payment goes to current month
      allocatedToCurrentMonth = remainingPayment;

      // Calculate the expected payroll details using the service
      const calculatedResult = await this.calculateMonthlyPayrollDetails(
        accessibleShopIds,
        userId,
        salaryMonth,
        {
          bonusAmount,
          bonusDescription,
          overtimeAmount,
          otherDeduction,
        }
      );

      if (!calculatedResult.status) {
        throw new Error(`Failed to calculate payroll: ${calculatedResult.message}`);
      }

      const calculated = calculatedResult.data;

      // Validation: Base Salary (should match exactly)
      if (Math.abs(parseFloat(baseSalary) - parseFloat(calculated.baseSalary)) > 0.01) {
        throw new Error(
          `Base salary mismatch. Expected: ${calculated.baseSalary}, Received: ${baseSalary}`
        );
      }

      // Validation: Commission (should match exactly - not editable)
      const expectedCommission = calculated.totalCommission || 0;
      const payloadCommission = calculationSnapshot?.commission?.commissionAmount || 0;
      if (Math.abs(parseFloat(expectedCommission) - parseFloat(payloadCommission)) > 0.01) {
        throw new Error(
          `Commission mismatch. Expected: ${expectedCommission}, Received: ${payloadCommission}`
        );
      }

      // Validation: Loan Deduction (should match calculated value)
      if (Math.abs(parseFloat(loanDeduction) - parseFloat(calculated.loanDeduction)) > 0.01) {
        throw new Error(
          `Loan deduction mismatch. Expected: ${calculated.loanDeduction}, Received: ${loanDeduction}`
        );
      }

      // Validation: Unpaid Leave Deduction (should match calculated value)
      const expectedLeaveDeduction = calculated.unpaidLeaveDeductionAmount || 0;
      const payloadLeaveDeduction = calculationSnapshot?.unpaidLeaveDeduction || 0;
      if (Math.abs(parseFloat(expectedLeaveDeduction) - parseFloat(payloadLeaveDeduction)) > 0.01) {
        throw new Error(
          `Unpaid leave deduction mismatch. Expected: ${expectedLeaveDeduction}, Received: ${payloadLeaveDeduction}`
        );
      }

      // Validation: Advance Amount (editable, but should be <= outstanding advance)
      const maxAdvanceDeduction = calculated.outstandingAdvance || 0;
      if (parseFloat(advanceAmount) > parseFloat(maxAdvanceDeduction)) {
        throw new Error(
          `Advance deduction (${advanceAmount}) exceeds outstanding advance (${maxAdvanceDeduction})`
        );
      }

      // Validation: Fine Amount (editable, but should match calculated if not overridden)
      const calculatedFine = calculated.fineAmount || 0;
      // Allow override but warn if significantly different
      // if (Math.abs(parseFloat(fineAmount) - parseFloat(calculatedFine)) > 0.01) {
      //   console.warn(
      //     `Fine amount differs from calculated. Calculated: ${calculatedFine}, Provided: ${fineAmount}`
      //   );
      // }

      // Calculate expected net payable salary
      const expectedGross =
        parseFloat(calculated.baseSalary) +
        parseFloat(calculated.totalCommission) +
        parseFloat(bonusAmount) +
        parseFloat(overtimeAmount);

      const expectedTotalDeductions =
        parseFloat(expectedLeaveDeduction) +
        parseFloat(advanceAmount) +
        parseFloat(fineAmount) +
        parseFloat(loanDeduction) +
        parseFloat(otherDeduction);

      const expectedNetPayable = expectedGross - expectedTotalDeductions;

      // Validation: Net Payable Salary (should match calculated)
      // if (Math.abs(parseFloat(netPayableSalary) - expectedNetPayable) > 0.01) {
      //   throw new Error(
      //     `Net payable salary mismatch. Expected: ${expectedNetPayable.toFixed(2)}, Received: ${netPayableSalary}`
      //   );
      // }

      // Validation: Paid Amount (should be <= net payable)
      // if (parseFloat(paidAmount) > parseFloat(netPayableSalary)) {
      //   throw new Error(
      //     `Paid amount (${paidAmount}) cannot exceed net payable salary (${netPayableSalary})`
      //   );
      // }

      // Validation: Paid Amount (should be >= 0)
      if (parseFloat(paidAmount) < 0) {
        throw new Error("Paid amount cannot be negative");
      }

      // Validation: Paid Amount should not exceed Net Payable Salary
      // if (parseFloat(paidAmount) > parseFloat(netPayableSalary)) {
      //   throw new Error(
      //     `Paid amount (${parseFloat(paidAmount).toFixed(2)}) cannot exceed net payable salary (${parseFloat(netPayableSalary).toFixed(2)}). ` +
      //     `Difference: ${(parseFloat(paidAmount) - parseFloat(netPayableSalary)).toFixed(2)}`
      //   );
      // }

      // Calculate due amount
      const dueAmount = parseFloat(netPayableSalary) - parseFloat(paidAmount);

      // Build enhanced calculation snapshot
      const enhancedSnapshot = {
        workingDays: calculated.totalWorkingDays,
        presentDays: calculated.totalWorkingDays - calculated.totalUnpaidLeaveDays,
        paidLeaveDays: calculated.totalPaidLeaveDays,
        unpaidLeaveDays: calculated.totalUnpaidLeaveDays,
        perDaySalary: calculated.baseSalary / calculated.totalWorkingDays,
        unpaidLeaveDeduction: expectedLeaveDeduction,

        advance: {
          totalTaken: calculated.totalAdvanceTaken,
          totalRepaidBefore: calculated.totalAdvanceRepaid,
          deductedThisMonth: parseFloat(advanceAmount),
          remaining: parseFloat(maxAdvanceDeduction) - parseFloat(advanceAmount),
        },

        ...(calculated.totalSales > 0 && {
          commission: {
            totalSales: calculated.totalSales,
            commissionRate: calculated.calculationSnapshot?.commissionData?.commissionRecords?.[0]?.commissionPercentage || "0%",
            commissionAmount: calculated.totalCommission,
          },
        }),

        salaryBreakdown: {
          gross: expectedGross,
          totalDeductions: expectedTotalDeductions,
          netPayable: parseFloat(netPayableSalary),
          paid: parseFloat(paidAmount),
          due: dueAmount,
        },

        // Payment Allocation Details
        paymentAllocation: {
          totalPaidAmount: parseFloat(paidAmount),
          allocatedToPreviousDues,
          allocatedToCurrentMonth,
          previousDuesPayments,
        },

        // Include original calculation snapshot
        originalCalculation: calculated.calculationSnapshot,
      };

      // Deduct allocatedToPreviousDues from current month's netPayableSalary
      const adjustedNetPayableSalary = Math.max(0, parseFloat(netPayableSalary) - allocatedToPreviousDues);

      let payrollRelease;
      let isUpdate = false;

      // Only create/update current month payroll if there's remaining payment after settling previous dues
      if (allocatedToCurrentMonth > 0 || existingPayroll) {
        if (existingPayroll) {
          // UPDATE EXISTING RECORD - Increment editable fields
          isUpdate = true;

          const updatedPaidAmount = parseFloat(existingPayroll.paidAmount || 0) + allocatedToCurrentMonth;
          const updatedAdvanceAmount = parseFloat(existingPayroll.advanceAmount || 0) + parseFloat(advanceAmount);
          const updatedBonusAmount = parseFloat(existingPayroll.bonusAmount || 0) + parseFloat(bonusAmount);
          const updatedOvertimeAmount = parseFloat(existingPayroll.overtimeAmount || 0) + parseFloat(overtimeAmount);
          const updatedFineAmount = parseFloat(existingPayroll.fineAmount || 0) + parseFloat(fineAmount);
          const updatedOtherDeduction = parseFloat(existingPayroll.otherDeduction || 0) + parseFloat(otherDeduction);

          // Recalculate net payable with updated values (deduct allocated to previous dues)
          const updatedGross =
            parseFloat(baseSalary) +
            parseFloat(calculated.totalCommission) +
            updatedBonusAmount +
            updatedOvertimeAmount;

          const updatedTotalDeductions =
            parseFloat(expectedLeaveDeduction) +
            updatedAdvanceAmount +
            updatedFineAmount +
            parseFloat(loanDeduction) +
            updatedOtherDeduction;

          const updatedNetPayable = adjustedNetPayableSalary;

          // Determine status: PENDING if there's remaining due, RELEASED if fully paid
          const updatedDueAmount = parseFloat(updatedNetPayable) - updatedPaidAmount;
          const payrollStatus = updatedDueAmount > 0.01 ? "PENDING" : "RELEASED";
          const releaseDate = payrollStatus === "RELEASED" ? new Date() : (existingPayroll.releaseDate || null);

          // Update the existing record
          await existingPayroll.update(
            {
              baseSalary: parseFloat(baseSalary),
              advanceAmount: updatedAdvanceAmount,
              bonusAmount: updatedBonusAmount,
              bonusDescription: bonusDescription || existingPayroll.bonusDescription,
              loanDeduction: parseFloat(loanDeduction),
              fineAmount: updatedFineAmount,
              overtimeAmount: updatedOvertimeAmount,
              otherDeduction: updatedOtherDeduction,
              netPayableSalary: updatedNetPayable,
              paidAmount: updatedPaidAmount,
              shopId,
              status: payrollStatus,
              releaseDate: releaseDate,
              releasedBy: payrollStatus === "RELEASED" ? adminId : existingPayroll.releasedBy,
              calculationSnapshot: {
                ...enhancedSnapshot,
                updateHistory: [
                  ...(existingPayroll.calculationSnapshot?.updateHistory || []),
                  {
                    updatedAt: new Date(),
                    updatedBy: adminId,
                    incrementedFields: {
                      paidAmount: allocatedToCurrentMonth,
                      advanceAmount: parseFloat(advanceAmount),
                      bonusAmount: parseFloat(bonusAmount),
                      overtimeAmount: parseFloat(overtimeAmount),
                      fineAmount: parseFloat(fineAmount),
                      otherDeduction: parseFloat(otherDeduction),
                    },
                    deductedFromNetPayable: allocatedToPreviousDues,
                  },
                ],
              },
            },
            { transaction }
          );

          payrollRelease = existingPayroll;
        } else {
          // CREATE NEW RECORD
          // Determine status: PENDING if there's remaining due, RELEASED if fully paid
          const currentMonthDue = parseFloat(adjustedNetPayableSalary) - allocatedToCurrentMonth;
          const payrollStatus = currentMonthDue > 0.01 ? "PENDING" : "RELEASED";
          const releaseDate = payrollStatus === "RELEASED" ? new Date() : null;

          payrollRelease = await PayrollRelease.create(
            {
              userId,
              salaryMonth,
              baseSalary: parseFloat(baseSalary),
              advanceAmount: parseFloat(advanceAmount),
              bonusAmount: parseFloat(bonusAmount),
              bonusDescription,
              loanDeduction: parseFloat(loanDeduction),
              fineAmount: parseFloat(fineAmount),
              overtimeAmount: parseFloat(overtimeAmount),
              otherDeduction: parseFloat(otherDeduction),
              netPayableSalary: parseFloat(adjustedNetPayableSalary),
              paidAmount: allocatedToCurrentMonth,
              shopId,
              status: payrollStatus,
              releaseDate: releaseDate,
              releasedBy: payrollStatus === "RELEASED" ? adminId : null,
              calculationSnapshot: enhancedSnapshot,
            },
            { transaction }
          );
        }
      }

      // Update loan balance if loan deduction was applied
      if (parseFloat(loanDeduction) > 0) {
        const employeeLoan = await EmployeeLoan.findOne({
          where: { employeeId: userId, status: "ACTIVE" },
          transaction,
        });

        if (employeeLoan) {
          const newRemainingBalance = parseFloat(employeeLoan.remainingBalance) - parseFloat(loanDeduction);
          await employeeLoan.update(
            {
              remainingBalance: Math.max(0, newRemainingBalance),
              status: newRemainingBalance <= 0 ? "COMPLETED" : "ACTIVE",
            },
            { transaction }
          );

          // Create loan payment record
          await LoanPayment.create(
            {
              loanId: employeeLoan.id,
              employeeId: userId,
              paidAmount: parseFloat(loanDeduction),
              paidBy: adminId,
            },
            { transaction }
          );
        }
      }

      // Update advance salary records if advance was deducted
      if (parseFloat(advanceAmount) > 0) {
        // Mark advance salaries as repaid (FIFO - First In First Out)
        const pendingAdvances = await AdvanceSalary.findAll({
          where: {
            userId,
            status: "APPROVED",
            salaryMonth: {
              [Op.lte]: salaryMonth,
            },
          },
          order: [["salaryMonth", "ASC"]],
          transaction,
        });

        let remainingDeduction = parseFloat(advanceAmount);
        for (const advance of pendingAdvances) {
          if (remainingDeduction <= 0) break;

          const advanceAmountValue = parseFloat(advance.amount);
          const deductionForThisAdvance = Math.min(advanceAmountValue, remainingDeduction);

          // Update advance status
          await advance.update(
            {
              status: deductionForThisAdvance >= advanceAmountValue ? "REPAID" : "PARTIALLY_REPAID",
              repaidAmount: (parseFloat(advance.repaidAmount || 0) + deductionForThisAdvance),
            },
            { transaction }
          );

          remainingDeduction -= deductionForThisAdvance;
        }
      }

      await transaction.commit();

      return {
        status: true,
        message: isUpdate
          ? "Payroll updated successfully - editable fields incremented"
          : "Payroll released successfully with validation",
        data: {
          ...payrollRelease.toJSON(),
          dueAmount,
          validationPassed: true,
          isUpdate,
          paymentAllocation: {
            totalPaidAmount: parseFloat(paidAmount),
            allocatedToPreviousDues,
            allocatedToCurrentMonth,
            previousDuesPayments,
          },
        },
      };
    } catch (error) {
      await transaction.rollback();
      console.error("releasePayrollWithValidation error:", error);
      return {
        status: false,
        message: error.message,
        validationPassed: false,
      };
    }
  },

  // ✅ Salary Release API for whole month newly payrol where each month payrloal should be once for each employee.
  //check 1st salery generate or not if generate already then throw error salery alredy generated otherwise generate all the employee payrlol from UserRole table.
  async releasePayrollForAllEmployeeByMonth(adminId, salaryMonth) {

    const transaction = await sequelize.transaction();

    try {

      // check first salary generate or not by this month and adminId
      const existingPayrolls = await PayrollRelease.findAll({
        where: { salaryMonth, shopId: adminId },
        transaction,
      });

      if (existingPayrolls.length > 0) {
        throw new Error("Payroll already generated for this month.");
      }


      // fetch all the employeeh from UserRole table by adminId
      const users = await UserRole.findAll({
        where: { parentUserId: adminId },
        transaction,
      });

      // This function is incomplete - use generatePayrollForAllEmployeesByMonth instead
      throw new Error("This function is incomplete. Use generatePayrollForAllEmployeesByMonth instead.");
    } catch (error) {
      await transaction.rollback();
      console.error("releasePayrollForAllEmployeeByMonth error:", error);
      return { status: false, message: error.message };
    }
  },



  // NEW: Full release history (admin view)
  // PayrollService.js - Updated for salaryMonth system
  async getFullReleaseHistory(query = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        userId,
        salaryMonth, // Filter by salary month
        status,
        releaseStartDate,
        releaseEndDate,
      } = query;

      const pageNum = Math.max(1, Number(page) || 1);
      const pageSizeNum = Math.max(1, Math.min(100, Number(pageSize) || 20));
      const offset = (pageNum - 1) * pageSizeNum;

      // Build WHERE conditions
      const where = {};

      if (userId) {
        where.userId = Number(userId);
      }
      if (salaryMonth) {
        where.salaryMonth = salaryMonth;
      }
      if (status) {
        where.status = status;
      }

      // Filter by when salary was released
      if (releaseStartDate || releaseEndDate) {
        where.releaseDate = {};
        if (releaseStartDate) where.releaseDate[Op.gte] = releaseStartDate;
        if (releaseEndDate)
          where.releaseDate[Op.lte] = moment(releaseEndDate).endOf('day').toDate(); // include full day
      }

      const { count, rows } = await PayrollRelease.findAndCountAll({
        where,
        include: [
          {
            model: UserRole,
            as: "UserRole",
            attributes: ["id", "fullName", "email", "role", "baseSalary"],
          },
          {
            model: User,
            as: "releaser", // the admin who released
            attributes: ["id", "fullName"],
          },
        ],
        order: [["salaryMonth", "DESC"]],
        limit: pageSizeNum,
        offset,
        distinct: true,
        col: "id",
      });

      const totalPages = Math.ceil(count / pageSizeNum);

      // Format response with readable dates
      const history = rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        fullName: r.UserRole?.fullName || "Unknown",
        email: r.UserRole?.email || "Unknown",
        role: r.UserRole?.role || "-",
        salaryMonth: r.salaryMonth,
        baseSalary: Number(r.baseSalary),
        advanceAmount: Number(r.advanceAmount),
        bonusAmount: Number(r.bonusAmount),
        bonusDescription: r.bonusDescription,
        loanDeduction: Number(r.loanDeduction),
        fineAmount: Number(r.fineAmount),
        overtimeAmount: Number(r.overtimeAmount),
        otherDeduction: Number(r.otherDeduction),
        netPayableSalary: Number(r.netPayableSalary),
        status: r.status,
        releaseDate: r.releaseDate ? moment(r.releaseDate).format("DD MMM YYYY, hh:mm A") : null,
        releaserId: r.releaser?.id || null,
        releaserFullname: r.releaser?.fullName || null,
        calculationSnapshot: r.calculationSnapshot || {},
      }));

      return { status: true, message: "Salary release history fetched successfully", data: { history, pagination: { page: pageNum, pageSize: pageSizeNum, totalCount: count, totalPages, hasMore: pageNum < totalPages, }, }, };
    } catch (error) {
      console.error("getFullReleaseHistory error:", error);
      return { status: false, message: error.message || "Failed to fetch release history", };
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
        order: [["salaryMonth", "DESC"]],
      });
      // Format the data to match the new PayrollRelease structure
      const formattedHistory = history.map(r => ({
        id: r.id,
        userId: r.userId,
        fullName: r.UserRole?.fullName || "Unknown",
        email: r.UserRole?.email || "Unknown",
        salaryMonth: r.salaryMonth,
        baseSalary: Number(r.baseSalary),
        advanceAmount: Number(r.advanceAmount),
        bonusAmount: Number(r.bonusAmount),
        bonusDescription: r.bonusDescription,
        loanDeduction: Number(r.loanDeduction),
        fineAmount: Number(r.fineAmount),
        overtimeAmount: Number(r.overtimeAmount),
        otherDeduction: Number(r.otherDeduction),
        netPayableSalary: Number(r.netPayableSalary),
        status: r.status,
        releaseDate: r.releaseDate ? moment(r.releaseDate).format("DD MMM YYYY, hh:mm A") : null,
        releaserId: r.releaser?.id || null,
        releaserFullname: r.releaser?.fullName || null,
        calculationSnapshot: r.calculationSnapshot || {},
      }));
      return { status: true, data: formattedHistory };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // === ADVANCE SALARY CRUD ===
  async createAdvanceSalary({ userId, salaryMonth, amount, reason }) {
    try {
      const user = await UserRole.findOne({
        where: { id: userId },
        attributes: ["id", "fullName", "baseSalary", "salaryStartDate"],
      });
      if (!user) throw new Error("Employee not found.");

      // Check if salaryStartDate is set
      if (!user.salaryStartDate) {
        throw new Error("Employee salary start date is not set. Please set the salary start date before requesting advance salary.");
      }

      // const baseSalary = parseFloat(user.baseSalary);
      if (amount <= 0) {
        throw new Error("Advance amount must be greater than 0.");
      }

      const advance = await AdvanceSalary.create({
        userId,
        salaryMonth,
        amount,
        reason,
        status: "PENDING",
        approvedBy: null, // Initially null
      });
      return { status: true, message: "Advance salary request created.", data: advance };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  async getAdvanceSalaries(accessibleShopIds, query = {}) {
    try {
      const { page = 1, pageSize = 10, userId, shopId, status, salaryMonth } = query;
      const pageNum = Number(page) || 1;
      const pageSizeNum = Number(pageSize) || 10;
      const offset = (pageNum - 1) * pageSizeNum;

      const where = {};
      const userWhere = {
        parentUserId:
          { [Op.in]: accessibleShopIds }
      };

      if (shopId) userWhere.parentUserId = Number(shopId);

      if (userId) userWhere.id = Number(userId);
      if (status) where.status = status;
      if (salaryMonth) where.salaryMonth = salaryMonth;

      const { count, rows } = await AdvanceSalary.findAndCountAll({
        where,
        include: [
          {
            model: UserRole,
            as: "UserRole",
            where: userWhere,
            attributes: ["id", "fullName", "email", "baseSalary"],
            include: [
              {
                model: User,
                as: "parent",
                attributes: ["id", "fullName"],
              },
            ]
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: pageSizeNum,
        offset,
      });

      const totalPages = Math.ceil(count / pageSizeNum);
      return { status: true, message: "Advance salaries fetched.", data: { advances: rows, pagination: { page: pageNum, pageSize: pageSizeNum, totalCount: count, totalPages }, }, };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  async updateAdvanceSalaryStatus(accessibleShopIds, adminId, advanceId, status) {
    try {
      const advance = await AdvanceSalary.findByPk(advanceId);
      if (!advance) throw new Error("Advance salary record not found.");

      // Ensure admin has rights to manage this user's advance
      const user = await UserRole.findOne({
        where: {
          id: advance.userId, parentUserId:
            { [Op.in]: accessibleShopIds }
        },
      });
      if (!user) throw new Error("Unauthorized to update this advance record.");

      await advance.update({ status, approvedBy: adminId });
      return { status: true, message: `Advance salary ${status.toLowerCase()}.`, data: advance };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  async deleteAdvanceSalary(accessibleShopIds, advanceId) {
    try {
      const advance = await AdvanceSalary.findByPk(advanceId);
      if (!advance) throw new Error("Advance salary record not found.");

      const user = await UserRole.findOne({
        where: { id: advance.userId, parentUserId: { [Op.in]: accessibleShopIds } },
      });
      if (!user) throw new Error("Unauthorized to delete this advance record.");

      await advance.destroy();
      return { status: true, message: "Advance salary record deleted." };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  /**
   * Get all payroll releases with comprehensive filters
   * Filters: search (username, amount), date range, status, userId, shopId
   */
  async getAllPayrollReleases(accessibleShopIds, query = {}) {
    try {
      const {
        page = 1,
        pageSize = 10,
        search,
        startDate,
        endDate,
        status,
        userId,
        shopId,
        minAmount,
        maxAmount,
      } = query;

      const pageNum = Number(page) || 1;
      const pageSizeNum = Number(pageSize) || 10;
      const offset = (pageNum - 1) * pageSizeNum;

      const where = {};
      const userWhere = { parentUserId: { [Op.in]: accessibleShopIds } };

      // Shop filter
      if (shopId) {
        where.shopId = Number(shopId);
      }

      // User filter
      if (userId) {
        where.userId = Number(userId);
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      // Date range filter (on salaryMonth)
      if (startDate || endDate) {
        where.salaryMonth = {};
        if (startDate) {
          where.salaryMonth[Op.gte] = startDate;
        }
        if (endDate) {
          where.salaryMonth[Op.lte] = endDate;
        }
      }

      // Amount range filter
      if (minAmount || maxAmount) {
        where.netPayableSalary = {};
        if (minAmount) {
          where.netPayableSalary[Op.gte] = parseFloat(minAmount);
        }
        if (maxAmount) {
          where.netPayableSalary[Op.lte] = parseFloat(maxAmount);
        }
      }

      // Search filter (username or amount)
      if (search) {
        const searchTerm = search.trim();

        // Check if search is a number (for amount search)
        const isNumeric = !isNaN(searchTerm) && searchTerm !== '';

        if (isNumeric) {
          // Search by amount fields
          where[Op.or] = [
            { netPayableSalary: { [Op.like]: `%${searchTerm}%` } },
            { paidAmount: { [Op.like]: `%${searchTerm}%` } },
            { baseSalary: { [Op.like]: `%${searchTerm}%` } },
          ];
        } else {
          // Search by username
          userWhere.fullName = { [Op.like]: `%${searchTerm}%` };
        }
      }

      const { count, rows } = await PayrollRelease.findAndCountAll({
        where,
        include: [
          {
            model: UserRole,
            as: "UserRole",
            where: userWhere,
            attributes: ["id", "fullName", "email", "role", "baseSalary"],
            include: [
              {
                model: User,
                as: "parent",
                attributes: ["id", "fullName", "businessName"],
              },
            ],
          },
          {
            model: User,
            as: "releaser",
            attributes: ["id", "fullName", "email"],
            required: false,
          },
        ],
        order: [
          ["salaryMonth", "DESC"],
          ["createdAt", "DESC"],
        ],
        limit: pageSizeNum,
        offset,
      });

      const totalPages = Math.ceil(count / pageSizeNum);

      return {
        status: true,
        message: "Payroll releases fetched successfully.",
        data: {
          releases: rows,
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
      console.error("getAllPayrollReleases Error:", error);
      return { status: false, message: error.message };
    }
  },

  /**
   * Get Lifetime Financial Summary for a User
   */
  async getLifetimeFinancials(userId) {
    try {
      // 1. Total Sales & Commissions
      const commissions = await StuffCommission.findAll({
        where: { UserRoleId: userId },
        attributes: ["baseAmount", "commissionAmount"],
      });

      const totalSales = commissions.reduce(
        (sum, c) => sum + parseFloat(c.baseAmount || 0),
        0
      );
      const totalCommission = commissions.reduce(
        (sum, c) => sum + parseFloat(c.commissionAmount || 0),
        0
      );

      // 2. Advance Salary
      const currentMonth = moment().format("YYYY-MM");
      const advanceData = await this.calculateOutstandingAdvance(userId, currentMonth);

      // 3. Leave Summary (Approved leaves in current year)
      const startOfYear = moment().startOf("year").format("YYYY-MM-DD");

      const leaveRequests = await LeaveRequest.findAll({
        where: {
          userId,
          status: "approved",
          startDate: { [Op.gte]: startOfYear },
        },
      });

      let totalLeaveDays = 0;
      leaveRequests.forEach((leave) => {
        const start = moment(leave.startDate);
        const end = moment(leave.endDate);
        const duration = end.diff(start, "days") + 1;
        totalLeaveDays += duration;
      });

      // 4. Payroll History Summary (Total Paid)
      const payrolls = await PayrollRelease.findAll({
        where: { userId, status: "RELEASED" },
        attributes: ["paidAmount"],
      });

      const totalSalaryPaid = payrolls.reduce((sum, p) => sum + parseFloat(p.paidAmount || 0), 0);

      return {
        totalSales: Number(totalSales.toFixed(2)),
        totalCommission: Number(totalCommission.toFixed(2)),
        advanceSalary: {
          totalTaken: Number(advanceData.totalAdvanceTaken.toFixed(2)),
          totalRepaid: Number(advanceData.totalAdvanceRepaid.toFixed(2)),
          outstanding: Number(advanceData.outstandingAdvance.toFixed(2)),
        },
        leaveSummary: {
          totalDaysThisYear: totalLeaveDays,
          requestsCount: leaveRequests.length,
        },
        salaryDetails: {
          totalPaidLifetime: Number(totalSalaryPaid.toFixed(2))
        }
      };
    } catch (error) {
      console.error("getLifetimeFinancials error:", error);
      throw error;
    }
  },

  /**
   * Delete Payroll Release
   * When deleting a payroll, we need to:
   * 1. Reverse advance salary deductions (reduce repaidAmount)
   * 2. Reverse loan deductions (restore loan balance)
   * 3. Delete the payroll record
   */
  async deletePayrollRelease(accessibleShopIds, payrollId) {
    const transaction = await sequelize.transaction();

    try {
      // Find the payroll release
      const payroll = await PayrollRelease.findByPk(payrollId, {
        include: [
          {
            model: UserRole,
            as: "UserRole",
            where: { parentUserId: { [Op.in]: accessibleShopIds } },
            attributes: ["id", "fullName", "parentUserId"],
          },
        ],
        transaction,
      });

      if (!payroll) {
        throw new Error("Payroll record not found or unauthorized.");
      }

      const { userId, salaryMonth, advanceAmount, loanDeduction } = payroll;

      // 1. Reverse advance salary deductions
      if (parseFloat(advanceAmount) > 0) {
        // Find all approved advances for this user up to this salary month
        const advances = await AdvanceSalary.findAll({
          where: {
            userId,
            status: { [Op.in]: ["APPROVED", "PARTIALLY_REPAID", "REPAID"] },
            salaryMonth: { [Op.lte]: salaryMonth },
          },
          order: [["salaryMonth", "ASC"]],
          transaction,
        });

        // Reverse the deduction (FIFO - same order as deduction)
        let remainingReversal = parseFloat(advanceAmount);

        for (const advance of advances) {
          if (remainingReversal <= 0) break;

          const currentRepaid = parseFloat(advance.repaidAmount || 0);
          const advanceTotal = parseFloat(advance.amount);

          // Calculate how much was deducted from this advance
          const deductedFromThis = Math.min(currentRepaid, remainingReversal);

          if (deductedFromThis > 0) {
            const newRepaidAmount = currentRepaid - deductedFromThis;

            // Update status based on new repaid amount
            let newStatus = "APPROVED";
            if (newRepaidAmount >= advanceTotal) {
              newStatus = "REPAID";
            } else if (newRepaidAmount > 0) {
              newStatus = "PARTIALLY_REPAID";
            }

            await advance.update(
              {
                repaidAmount: newRepaidAmount,
                status: newStatus,
              },
              { transaction }
            );

            remainingReversal -= deductedFromThis;
          }
        }
      }

      // 2. Reverse loan deductions
      if (parseFloat(loanDeduction) > 0) {
        // Find the active loan for this user
        const employeeLoan = await EmployeeLoan.findOne({
          where: {
            employeeId: userId,
            status: { [Op.in]: ["ACTIVE", "COMPLETED"] },
          },
          transaction,
        });

        if (employeeLoan) {
          // Restore the loan balance
          const newRemainingBalance = parseFloat(employeeLoan.remainingBalance) + parseFloat(loanDeduction);
          const totalLoanAmount = parseFloat(employeeLoan.loanAmount);

          await employeeLoan.update(
            {
              remainingBalance: Math.min(newRemainingBalance, totalLoanAmount),
              status: newRemainingBalance > 0 ? "ACTIVE" : "COMPLETED",
            },
            { transaction }
          );

          // Delete the loan payment record for this payroll
          await LoanPayment.destroy({
            where: {
              loanId: employeeLoan.id,
              employeeId: userId,
              paidAmount: parseFloat(loanDeduction),
            },
            limit: 1,
            order: [["createdAt", "DESC"]],
            transaction,
          });
        }
      }

      // 3. Delete the payroll record
      await payroll.destroy({ transaction });

      await transaction.commit();

      return {
        status: true,
        message: "Payroll record deleted successfully. Advance and loan deductions have been reversed.",
      };
    } catch (error) {
      await transaction.rollback();
      console.error("deletePayrollRelease error:", error);
      return {
        status: false,
        message: error.message || "Failed to delete payroll record.",
      };
    }
  },

};

module.exports = PayrollService;
