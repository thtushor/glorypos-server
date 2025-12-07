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

      return { status: true, message: `Attendance updated: ${type.toUpperCase()}`, data: record };
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
      console.error("LeaveHistory Error:", error);
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

  // Case 5,6: Get salary details for month (preview) - Renamed and refactored
  async calculateMonthlyPayrollDetails(adminId, userId, salaryMonth) {
    try {
      // Derive start and end dates from salaryMonth
      const monthStart = moment(salaryMonth, "YYYY-MM").startOf("month");
      const monthEnd = moment(salaryMonth, "YYYY-MM").endOf("month");

      if (!monthStart.isValid() || !monthEnd.isValid()) {
        throw new Error("Invalid salaryMonth format. Use YYYY-MM.");
      }

      const startDate = monthStart.format("YYYY-MM-DD");
      const endDate = monthEnd.format("YYYY-MM-DD");

      // Fetch user details including base salary
      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
        attributes: ["id", "fullName", "baseSalary", "requiredDailyHours"],
      });

      // Use baseSalary from User model, as UserRole might not have it directly.
      const baseSalary = parseFloat(user.baseSalary);

      if (!user || !baseSalary || !user.requiredDailyHours) {
        throw new Error("User not found or base salary/hours not configured");
      }

      // Fetch additional payroll components
      const [advanceSalaries, employeeLoan, payrollFines, stuffCommissions] = await Promise.all([
        AdvanceSalary.findAll({
          where: { userId, salaryMonth, status: "APPROVED" },
          attributes: ["amount"],
        }),
        EmployeeLoan.findOne({
          where: { employeeId: userId, status: "ACTIVE" },
          attributes: ["monthlyEMI", "remainingBalance"],
        }),
        PayrollFine.findAll({
          where: { userId, salaryMonth },
          attributes: ["amount"],
        }),
        StuffCommission.findAll({
          where: {
            UserRoleId: userId,
            createdAt: {
              [Op.gte]: monthStart.toDate(),
              [Op.lte]: monthEnd.toDate(),
            },
          },
        }),
      ]);

      const totalAdvance = advanceSalaries.reduce(
        (sum, adv) => sum + parseFloat(adv.amount),
        0
      );

      let loanDeduction = 0;
      if (employeeLoan && parseFloat(employeeLoan.remainingBalance) > 0) {
        loanDeduction = Math.min(
          parseFloat(employeeLoan.monthlyEMI),
          parseFloat(employeeLoan.remainingBalance)
        );
      }

      const totalFine = payrollFines.reduce(
        (sum, fine) => sum + parseFloat(fine.amount),
        0
      );

      const totalCommission = stuffCommissions.reduce(
        (acc, comm) => acc + parseFloat(comm.commissionAmount),
        0
      );

      const requiredDailyHours = parseInt(user.requiredDailyHours);

      const weekendDays = process.env.WEEKEND_DAYS
        ? process.env.WEEKEND_DAYS.split(",").map(Number)
        : [5, 6]; // Friday & Saturday

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
          attributes: [
            "date",
            "type",
            "isHalfDay",
            "lateMinutes",
            "extraMinutes",
          ],
          raw: true,
        }),
      ]);

      // Build holiday & leave sets
      const holidayDates = new Set();
      holidays.forEach((h) => {
        let d = moment(h.startDate);
        const e = moment(h.endDate);
        while (d <= e) {
          holidayDates.add(d.format("YYYY-MM-DD"));
          d.add(1, "day");
        }
      });

      const leaveDates = new Set();
      approvedLeaves.forEach((leave) => {
        let d = moment(leave.startDate);
        const e = moment(leave.endDate);
        while (d <= e) {
          leaveDates.add(d.format("YYYY-MM-DD"));
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
      let totalAbsentMinutes = 0;
      let totalExtraMinutes = 0;
      let totalHolidayDays = 0;
      let totalLeaveDays = 0;

      // STRING-BASED LOOP - 100% SAFE
      let currentDateStr = startDate;

      while (currentDateStr <= endDate) {
        const dayOfWeek = moment(currentDateStr).day();

        // Skip weekends
        if (weekendDays.includes(dayOfWeek)) {
          totalWeekendDays++;
          currentDateStr = moment(currentDateStr).add(1, "day").format("YYYY-MM-DD");
          continue;
        }

        // Every non-weekend day is a paid working day
        totalWorkingDays++;

        // CHECK ATTENDANCE FIRST (Critical!)
        const att = attendanceMap[currentDateStr];
        let absentMinutesToday = 0;

        if (att) {
          if (att.type === "absent") {
            absentMinutesToday = requiredDailyHours * 60; // Full day absent
          } else if (att.type === "present") {
            if (att.isHalfDay)
              absentMinutesToday += requiredDailyHours * 60 * 0.5;
            if (att.lateMinutes > 0)
              absentMinutesToday += parseInt(att.lateMinutes);
            if (att.extraMinutes > 0)
              totalExtraMinutes += parseInt(att.extraMinutes);
          }
        }
        // No record = full present

        totalAbsentMinutes += absentMinutesToday;

        // Count holidays & leaves (for display only)
        if (holidayDates.has(currentDateStr)) totalHolidayDays++;
        if (leaveDates.has(currentDateStr)) totalLeaveDays++;

        // Next day
        currentDateStr = moment(currentDateStr).add(1, "day").format("YYYY-MM-DD");
      }

      // Final calculations
      const netAbsentMinutes = Math.max(
        0,
        totalAbsentMinutes - totalExtraMinutes
      );
      const netAbsentHours = Number((netAbsentMinutes / 60).toFixed(2));

      const requiredTotalHours = Number((totalWorkingDays * requiredDailyHours).toFixed(2));
      const workedHours = Number((requiredTotalHours - netAbsentHours).toFixed(2));

      const totalMinutesInMonth = totalWorkingDays * requiredDailyHours * 60; // Total expected minutes for the working days in the month
      const perMinuteRate = baseSalary / totalMinutesInMonth; // Per minute rate based on base salary for actual working days
      const netAttendanceSalary = Number((totalMinutesInMonth - netAbsentMinutes) * perMinuteRate).toFixed(2);

      // Placeholder for bonusAmount (Rule 2) - should be fetched from a Bonus table if implemented
      const bonusAmount = totalCommission; // Using totalCommission as bonusAmount for now
      const bonusDescription = null; // Placeholder for bonusDescription

      // Placeholder for overtimeAmount (Rule 5) - should be fetched from an Overtime table if implemented
      // For now, calculate based on extra minutes
      const overtimeAmount = Number((totalExtraMinutes / 60).toFixed(2)) * (baseSalary / (30 * requiredDailyHours)); // Rough calculation

      // Placeholder for otherDeduction (Rule 6) - should be fetched from an OtherDeduction table if implemented
      const otherDeduction = 0;

      // ✅ Final netPayableSalary calculation (Rule 7)
      const netPayableSalary =
        parseFloat(netAttendanceSalary) + bonusAmount + overtimeAmount - totalAdvance - loanDeduction - totalFine - otherDeduction;

      const data = {
        userId,
        fullName: user.fullName,
        salaryMonth,
        baseSalary,
        requiredDailyHours,
        totalWorkingDays,
        totalWeekendDays,
        requiredTotalHours,
        workedHours,
        absentHours: netAbsentHours,
        calculatedOvertimeHours: Number((totalExtraMinutes / 60).toFixed(2)),
        totalLeaveDays,
        totalHolidayDays,
        netAttendanceSalary: Math.max(0, parseFloat(netAttendanceSalary)), // Based on attendance
        bonusAmount: bonusAmount,
        bonusDescription: bonusDescription,
        overtimeAmount: overtimeAmount,
        advanceAmount: totalAdvance,
        loanDeduction: loanDeduction,
        fineAmount: totalFine,
        otherDeduction: otherDeduction,
        netPayableSalary: Math.max(0, netPayableSalary),
        status: "PENDING", // Default status for generated payroll
        releaseDate: null,
        releasedBy: null,
      };

      return { status: true, message: "Salary calculated successfully", data };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // \u2705 Payroll Monthly Auto Generator API
  async generateMonthlyPayroll(adminId, { userId, salaryMonth }) {
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
        adminId,
        userId,
        salaryMonth
      );

      if (!salaryDetailsResult.status) {
        throw new Error(
          `Failed to calculate salary for employee ${userId}: ${salaryDetailsResult.message}`
        );
      }

      const calculationSnapshot = salaryDetailsResult.data; // All data is the snapshot

      const payrollRelease = await PayrollRelease.create(
        {
          userId,
          salaryMonth,
          baseSalary: calculationSnapshot.baseSalary,
          advanceAmount: calculationSnapshot.advanceAmount,
          bonusAmount: calculationSnapshot.bonusAmount,
          bonusDescription: calculationSnapshot.bonusDescription,
          loanDeduction: calculationSnapshot.loanDeduction,
          fineAmount: calculationSnapshot.fineAmount,
          overtimeAmount: calculationSnapshot.overtimeAmount,
          otherDeduction: calculationSnapshot.otherDeduction,
          netPayableSalary: calculationSnapshot.netPayableSalary,
          status: "PENDING",
          releaseDate: null,
          releasedBy: null,
          calculationSnapshot: calculationSnapshot,
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
  async releasePayroll(adminId, payrollReleaseId) {
    const transaction = await sequelize.transaction();
    try {
      const payrollRelease = await PayrollRelease.findOne({
        where: { id: payrollReleaseId, shopId: adminId },
        transaction,
      });

      if (!payrollRelease) {
        throw new Error("Payroll record not found.");
      }

      if (payrollRelease.status === "RELEASED") {
        throw new Error("Payroll has already been released.");
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

      await payrollRelease.update(
        {
          status: "RELEASED",
          releaseDate: moment().toDate(),
          releasedBy: adminId,
        },
        { transaction }
      );

      await transaction.commit();
      return { status: true, message: "Payroll released successfully", data: payrollRelease };
    } catch (error) {
      await transaction.rollback();
      return { status: false, message: error.message };
    }
  },

  // \u2705 Salary Release API for whole month newly payrol where each month payrloal should be once for each employee.
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

      for (const user of users) {
        // check any advance salery on this month or not calculate total advance salery from Advance salery month from @api\entity\AdvanceSalary.js .
        const totalAdvanceSaleryByUser  = 0;

        // calcualte total commissionByUser from @api\entity\StuffCommission.js
        const totalCommissionsByUser = 0;

        const totalSaleryThisMonth = user.baseSalary;

        const totalAbsent = 0;
      }

    

    }
    catch (error) {
      console.log({error})
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
  async createAdvanceSalary(adminId, { userId, salaryMonth, amount, reason }) {
    try {
      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
        attributes: ["id", "fullName", "baseSalary"],
      });
      if (!user) throw new Error("Employee not found.");

      const baseSalary = parseFloat(user.baseSalary);
      if (amount > baseSalary) {
        throw new Error("Advance amount cannot exceed base salary.");
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

  async getAdvanceSalaries(adminId, query = {}) {
    try {
      const { page = 1, pageSize = 10, userId, status, salaryMonth } = query;
      const pageNum = Number(page) || 1;
      const pageSizeNum = Number(pageSize) || 10;
      const offset = (pageNum - 1) * pageSizeNum;

      const where = {};
      const userWhere = { parentUserId: adminId };

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
            attributes: ["id", "fullName", "email"],
          },
          {
            model: User,
            as: "approver",
            attributes: ["id", "fullName"],
            required: false,
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

  async updateAdvanceSalaryStatus(adminId, advanceId, status) {
    try {
      const advance = await AdvanceSalary.findByPk(advanceId);
      if (!advance) throw new Error("Advance salary record not found.");

      // Ensure admin has rights to manage this user's advance
      const user = await UserRole.findOne({
        where: { id: advance.userId, parentUserId: adminId },
      });
      if (!user) throw new Error("Unauthorized to update this advance record.");

      await advance.update({ status, approvedBy: adminId });
      return { status: true, message: `Advance salary ${status.toLowerCase()}.`, data: advance };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  async deleteAdvanceSalary(adminId, advanceId) {
    try {
      const advance = await AdvanceSalary.findByPk(advanceId);
      if (!advance) throw new Error("Advance salary record not found.");

      const user = await UserRole.findOne({
        where: { id: advance.userId, parentUserId: adminId },
      });
      if (!user) throw new Error("Unauthorized to delete this advance record.");

      await advance.destroy();
      return { status: true, message: "Advance salary record deleted." };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // === PAYROLL FINE CRUD ===
  async createPayrollFine(adminId, { userId, salaryMonth, amount, reason }) {
    try {
      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
      });
      if (!user) throw new Error("Employee not found.");

      const fine = await PayrollFine.create({
        userId,
        salaryMonth,
        amount,
        reason,
      });
      return { status: true, message: "Payroll fine added.", data: fine };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  async getPayrollFines(adminId, query = {}) {
    try {
      const { page = 1, pageSize = 10, userId, salaryMonth } = query;
      const pageNum = Number(page) || 1;
      const pageSizeNum = Number(pageSize) || 10;
      const offset = (pageNum - 1) * pageSizeNum;

      const where = {};
      const userWhere = { parentUserId: adminId };

      if (userId) userWhere.id = Number(userId);
      if (salaryMonth) where.salaryMonth = salaryMonth;

      const { count, rows } = await PayrollFine.findAndCountAll({
        where,
        include: [
          {
            model: UserRole,
            as: "UserRole",
            where: userWhere,
            attributes: ["id", "fullName", "email"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: pageSizeNum,
        offset,
      });

      const totalPages = Math.ceil(count / pageSizeNum);
      return { status: true, message: "Payroll fines fetched.", data: { fines: rows, pagination: { page: pageNum, pageSize: pageSizeNum, totalCount: count, totalPages }, }, };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  async deletePayrollFine(adminId, fineId) {
    try {
      const fine = await PayrollFine.findByPk(fineId);
      if (!fine) throw new Error("Payroll fine record not found.");

      const user = await UserRole.findOne({
        where: { id: fine.userId, parentUserId: adminId },
      });
      if (!user) throw new Error("Unauthorized to delete this fine record.");

      await fine.destroy();
      return { status: true, message: "Payroll fine record deleted." };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },
};

module.exports = PayrollService;
