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

      return {
        status: true,
        message: "Holiday added successfully",
        data: holiday,
      };
    } catch (error) {
      return {
        status: false,
        message: error.message || "Failed to add holiday",
      };
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

      return {
        status: true,
        message: "Holidays fetched successfully",
        data: {
          holidays: rows,
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
      console.error("GetHolidays Error:", error);
      return {
        status: false,
        message: error.message || "Failed to fetch holidays",
      };
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
  async getSalaryDetailsInRange(adminId, userId, startDate, endDate) {
    try {
      const start = moment(startDate);
      const end = moment(endDate);

      if (!start.isValid() || !end.isValid() || start > end) {
        throw new Error("Invalid startDate or endDate");
      }

      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
        attributes: ["id", "fullName", "baseSalary", "requiredDailyHours"],
      });

      if (!user || !user.baseSalary || !user.requiredDailyHours) {
        throw new Error("User not found or salary/hours not configured");
      }

      const baseSalary = parseFloat(user.baseSalary);
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
          currentDateStr = moment(currentDateStr)
            .add(1, "day")
            .format("YYYY-MM-DD");
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
        currentDateStr = moment(currentDateStr)
          .add(1, "day")
          .format("YYYY-MM-DD");
      }

      // Final calculations
      const netAbsentMinutes = Math.max(
        0,
        totalAbsentMinutes - totalExtraMinutes
      );
      const netAbsentHours = Number((netAbsentMinutes / 60).toFixed(2));

      const requiredTotalHours = Number(
        (totalWorkingDays * requiredDailyHours).toFixed(2)
      );
      const workedHours = Number(
        (requiredTotalHours - netAbsentHours).toFixed(2)
      );

      const totalMinutesIn30Days = 30 * requiredDailyHours * 60;
      const perMinuteRate = baseSalary / totalMinutesIn30Days;
      const netSalary = Number(
        (totalMinutesIn30Days - netAbsentMinutes) * perMinuteRate
      ).toFixed(2);

      const commissions = await StuffCommission.findAll({
        where: {
          UserRoleId: userId,
          createdAt: {
            [Op.gte]: moment(startDate).toDate(),
            [Op.lte]: moment(endDate).toDate(),
          },
        },
      });

      const totalCommission = commissions.reduce(
        (acc, comm) => acc + parseFloat(comm.commissionAmount),
        0
      );

      const finalSalary = parseFloat(netSalary) + totalCommission;

      const data = {
        userId,
        fullName: user.fullName,
        startDate,
        endDate,
        baseSalary,
        requiredDailyHours,
        totalWorkingDays,
        totalWeekendDays,
        requiredTotalHours,
        workedHours,
        absentHours: netAbsentHours,
        overtimeHours: Number((totalExtraMinutes / 60).toFixed(2)),
        totalLeaveDays,
        totalHolidayDays,
        netSalary: Math.max(0, parseFloat(netSalary)),
        totalCommission,
        finalSalary,
      };

      return {
        status: true,
        message: "Salary calculated successfully",
        data,
      };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  async getSalaryDetailsInRange(adminId, userId, startDate, endDate) {
    try {
      const start = moment(startDate);
      const end = moment(endDate);

      if (!start.isValid() || !end.isValid() || start > end) {
        throw new Error("Invalid startDate or endDate");
      }

      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
        attributes: ["id", "fullName", "baseSalary", "requiredDailyHours"],
      });

      if (!user || !user.baseSalary || !user.requiredDailyHours) {
        throw new Error("User not found or salary/hours not configured");
      }

      const baseSalary = parseFloat(user.baseSalary);
      const requiredDailyHours = parseInt(user.requiredDailyHours);

      const weekendDays = process.env.WEEKEND_DAYS
        ? process.env.WEEKEND_DAYS.split(",").map(Number)
        : [3]; // Friday

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

      console.log("holidays", holidays);

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

      // Attendance map - keys are exact string dates from DB
      const attendanceMap = {};
      attendances.forEach((att) => {
        attendanceMap[att.date] = att;
      });

      // console.log("attendanceMap", attendanceMap);

      // Counters
      let totalWorkingDays = 0;
      let totalWeekendDays = 0;
      let totalAbsentMinutes = 0;
      let totalExtraMinutes = 0;
      let totalHolidayDays = 0;
      let totalLeaveDays = 0;

      // STRING-BASED LOOP - 100% SAFE FROM TIMEZONE ISSUES
      let currentDateStr = startDate; // e.g. "2025-11-01"
      console.log(currentDateStr, "<=>", currentDateStr);
      while (currentDateStr <= endDate) {
        const dayOfWeek = moment(currentDateStr).day();

        if (weekendDays.includes(dayOfWeek)) {
          totalWeekendDays++;
          currentDateStr = moment(currentDateStr)
            .add(1, "day")
            .format("YYYY-MM-DD");
          continue;
        }

        if (holidayDates.has(currentDateStr)) {
          totalHolidayDays++;
          totalWorkingDays++;
          currentDateStr = moment(currentDateStr)
            .add(1, "day")
            .format("YYYY-MM-DD");
          continue;
        }

        if (leaveDates.has(currentDateStr)) {
          totalLeaveDays++;
          totalWorkingDays++;
          currentDateStr = moment(currentDateStr)
            .add(1, "day")
            .format("YYYY-MM-DD");
          continue;
        }

        totalWorkingDays++;

        // console.log("currentDateStr up", "<=>", currentDateStr);
        // console.log("attendanceMap", "<=>", attendanceMap);
        const att = attendanceMap[currentDateStr]; // EXACT MATCH - WILL BE FOUND
        // console.log("Date:", currentDateStr, "Attendance:", att);

        let absentMinutesToday = 0;

        if (att) {
          if (att.type === "absent") {
            // FULL DAY ABSENT - ALWAYS 8 HOURS
            absentMinutesToday = requiredDailyHours * 60;
          } else if (att.type === "present") {
            if (att.isHalfDay)
              absentMinutesToday += requiredDailyHours * 60 * 0.5;
            if (att.lateMinutes > 0)
              absentMinutesToday += parseInt(att.lateMinutes);
            if (att.extraMinutes > 0)
              totalExtraMinutes += parseInt(att.extraMinutes);
          }
        }
        // No record = full present = 0 absent minutes

        totalAbsentMinutes += absentMinutesToday;
        currentDateStr = moment(currentDateStr)
          .add(1, "day")
          .format("YYYY-MM-DD");
      }

      // Final calculations
      const netAbsentMinutes = Math.max(
        0,
        totalAbsentMinutes - totalExtraMinutes
      );
      const netAbsentHours = Number((netAbsentMinutes / 60).toFixed(2));

      const requiredTotalHours = Number(
        (totalWorkingDays * requiredDailyHours).toFixed(2)
      );
      const workedHours = Number(
        (requiredTotalHours - netAbsentHours).toFixed(2)
      );

      const totalMinutesIn30Days = 30 * requiredDailyHours * 60;
      const perMinuteRate = baseSalary / totalMinutesIn30Days;
      const netSalary = Number(
        (totalMinutesIn30Days - netAbsentMinutes) * perMinuteRate
      ).toFixed(2);

      const data = {
        userId,
        fullName: user.fullName,
        startDate,
        endDate,
        baseSalary,
        requiredDailyHours,
        totalWorkingDays,
        totalWeekendDays,
        requiredTotalHours,
        workedHours,
        absentHours: netAbsentHours,
        overtimeHours: Number((totalExtraMinutes / 60).toFixed(2)),
        totalLeaveDays,
        totalHolidayDays,
        netSalary: Math.max(0, parseFloat(netSalary)),
      };

      return {
        status: true,
        message: "Salary calculated successfully",
        data,
      };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  async releaseFullSalary(adminId, { employeeId, startDate, endDate }) {
    const transaction = await sequelize.transaction();
    try {
      // Step 1: Calculate the definitive salary details on the backend
      const salaryDetailsResult = await this.getSalaryDetailsInRange(
        adminId,
        employeeId,
        startDate,
        endDate
      );

      if (!salaryDetailsResult.status) {
        throw new Error(
          `Failed to calculate salary for employee ${employeeId}: ${salaryDetailsResult.message}`
        );
      }

      const { finalSalary, ...calculationSnapshot } = salaryDetailsResult.data;

      // Step 2: Create the full salary release record with the calculated amount
      const salaryRelease = await PayrollRelease.create(
        {
          userId: employeeId,
          startDate,
          endDate,
          releaseType: "FULL",
          amount: finalSalary, // Use the calculated final salary
          calculationSnapshot,
          releasedBy: adminId,
        },
        { transaction }
      );

      // 2. Check for active loans and deduct EMI
      const activeLoan = await EmployeeLoan.findOne({
        where: { employeeId, status: "ACTIVE" },
        transaction,
      });

      if (activeLoan) {
        const emi = parseFloat(activeLoan.monthlyEMI);
        const remaining = parseFloat(activeLoan.remainingBalance);
        const deductionAmount = Math.min(emi, remaining);

        // Create a loan deduction entry in PayrollRelease
        await PayrollRelease.create(
          {
            userId: employeeId,
            startDate,
            endDate,
            releaseType: "LOAN_DEDUCTION",
            amount: deductionAmount,
            calculationSnapshot: {
              loanId: activeLoan.id,
              emi: emi,
              originalSnapshot: calculationSnapshot,
            },
            releasedBy: adminId,
          },
          { transaction }
        );

        // Create a record in LoanPayment
        await LoanPayment.create(
          {
            loanId: activeLoan.id,
            employeeId,
            paidAmount: deductionAmount,
            paidBy: adminId,
          },
          { transaction }
        );

        // Update the loan's remaining balance
        const newRemainingBalance = remaining - deductionAmount;
        activeLoan.remainingBalance = newRemainingBalance;
        if (newRemainingBalance <= 0) {
          activeLoan.status = "COMPLETED";
        }
        await activeLoan.save({ transaction });
      }

      await transaction.commit();
      return {
        status: true,
        message: "Full salary released successfully.",
        data: salaryRelease,
      };
    } catch (error) {
      await transaction.rollback();
      return { status: false, message: error.message };
    }
  },

  async releaseAdvanceSalary(adminId, { employeeId, amount, notes }) {
    try {
      const release = await PayrollRelease.create({
        userId: employeeId,
        startDate: moment().startOf("month").format("YYYY-MM-DD"),
        endDate: moment().endOf("month").format("YYYY-MM-DD"),
        releaseType: "ADVANCE",
        amount,
        calculationSnapshot: { notes },
        releasedBy: adminId,
      });
      return {
        status: true,
        message: "Advance salary released.",
        data: release,
      };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  async releasePartialSalary(adminId, { employeeId, amount, notes }) {
    try {
      const release = await PayrollRelease.create({
        userId: employeeId,
        startDate: moment().startOf("month").format("YYYY-MM-DD"),
        endDate: moment().endOf("month").format("YYYY-MM-DD"),
        releaseType: "PARTIAL",
        amount,
        calculationSnapshot: { notes },
        releasedBy: adminId,
      });
      return {
        status: true,
        message: "Partial salary released.",
        data: release,
      };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  async releaseBonus(adminId, { employeeId, amount, notes }) {
    try {
      const release = await PayrollRelease.create({
        userId: employeeId,
        startDate: moment().startOf("month").format("YYYY-MM-DD"),
        endDate: moment().endOf("month").format("YYYY-MM-DD"),
        releaseType: "BONUS",
        amount,
        calculationSnapshot: { notes },
        releasedBy: adminId,
      });
      return { status: true, message: "Bonus released.", data: release };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },

  // NEW: Full release history (admin view)
  // PayrollService.js - Updated for startDate/endDate system
  async getFullReleaseHistory(query = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        userId,
        startDate, // e.g. "2025-11-01"
        endDate, // e.g. "2025-11-30"
        periodStart, // Optional: filter by salary period start
        periodEnd, // Optional: filter by salary period end
      } = query;

      const pageNum = Math.max(1, Number(page) || 1);
      const pageSizeNum = Math.max(1, Math.min(100, Number(pageSize) || 20));
      const offset = (pageNum - 1) * pageSizeNum;

      // Build WHERE conditions
      const where = {};

      if (userId) {
        where.userId = Number(userId);
      }

      // Filter by salary period (most useful)
      if (periodStart || periodEnd) {
        where.startDate = {};
        if (periodStart) where.startDate[Op.gte] = periodStart;
        if (periodEnd) where.startDate[Op.lte] = periodEnd;
      }

      // OR: Filter by when salary was released
      if (startDate || endDate) {
        where.releaseDate = {};
        if (startDate) where.releaseDate[Op.gte] = startDate;
        if (endDate)
          where.releaseDate[Op.lte] = new Date(endDate + "T23:59:59.999Z"); // include full day
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
        order: [["releaseDate", "DESC"]],
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
        period: `${moment(r.startDate).format("DD MMM YYYY")} – ${moment(
          r.endDate
        ).format("DD MMM YYYY")}`,
        releasedAmount: Number(r.releasedAmount),
        releasedOn: moment(r.releaseDate).format("DD MMM YYYY, hh:mm A"),
        releaserId: r.releaser?.id || "System",
        releaserFullname: r.releaser?.fullName || "System",
        details: r.details || {},
      }));

      return {
        status: true,
        message: "Salary release history fetched successfully",
        data: {
          history,
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
      return {
        status: false,
        message: error.message || "Failed to fetch release history",
      };
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
