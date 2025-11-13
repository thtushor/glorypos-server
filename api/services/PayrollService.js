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
} = require("../entity");

const PayrollService = {
  // Case 4: Mark multiple users present for a date
  // Case 4: Mark multiple users present for today's date

  async markMultipleAttendance(adminId, { userIds }) {
    const transaction = await sequelize.transaction();
    let result;

    try {
      const date = moment().format("YYYY-MM-DD");

      // Validate users
      const users = await UserRole.findAll({
        where: { id: { [Op.in]: userIds }, parentUserId: adminId },
        transaction,
      });

      if (users.length !== userIds.length) {
        throw new Error("Invalid users");
      }

      // Check existing
      const existing = await Attendance.findAll({
        where: { userId: { [Op.in]: userIds }, date },
        transaction,
      });
      const alreadyMarkedIds = existing.map((a) => a.userId);
      const newUserIds = userIds.filter((id) => !alreadyMarkedIds.includes(id));

      if (newUserIds.length === 0) {
        throw new Error(
          "Attendance already marked for all selected users today"
        );
      }

      // Create records
      const attendances = newUserIds.map((userId) => ({
        userId,
        date,
        lateMinutes: 0,
        extraMinutes: 0,
        isHalfDay: false,
        isFullAbsent: false,
      }));

      await Attendance.bulkCreate(attendances, { transaction });

      // COMMIT ONLY AFTER SUCCESS
      await transaction.commit();

      result = {
        status: true,
        message: `Attendance marked for ${newUserIds.length} user(s) today`,
        data: attendances,
      };
    } catch (error) {
      // ROLLBACK ONLY IF NOT COMMITTED
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Rollback failed (already committed):", rollbackError);
      }

      result = { status: false, message: error.message };
    }

    return result; // ← ALWAYS RETURN HERE
  },

  // Case 4: Update attendance details for one user
  async updateAttendance(
    adminId,
    userId,
    { lateMinutes, extraMinutes, isHalfDay, isFullAbsent, notes }
  ) {
    try {
      const date = moment().format("YYYY-MM-DD");
      if (lateMinutes < 0 || extraMinutes < 0) {
        throw new Error("Minutes cannot be negative");
      }

      // Check user belongs to admin
      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
      });
      if (!user) {
        throw new Error("User not found");
      }

      // Find or create attendance
      const [attendance] = await Attendance.findOrCreate({
        where: { userId, date },
        defaults: {
          lateMinutes: 0,
          extraMinutes: 0,
          isHalfDay: false,
          isFullAbsent: false,
        },
      });

      // Update
      await attendance.update({
        lateMinutes,
        extraMinutes,
        isHalfDay,
        isFullAbsent,
        notes,
      });

      return {
        status: true,
        message: "Attendance updated successfully",
        data: attendance,
      };
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

  // Case 5,6: Get salary details for month (preview)
  async getSalaryDetails(adminId, userId, month) {
    // month 'YYYY-MM'
    try {
      const startDate = moment(month + "-01", "YYYY-MM-DD");
      const endDate = startDate.clone().endOf("month");
      if (!startDate.isValid()) {
        throw new Error("Invalid month");
      }

      const user = await UserRole.findOne({
        where: { id: userId, parentUserId: adminId },
      });
      if (!user || !user.requiredDailyHours) {
        throw new Error("User not found or incomplete setup");
      }

      // Get salary histories
      const salaryHistories = await SalaryHistory.findAll({
        where: { userId },
        order: [["startDate", "ASC"]],
      });

      // Get holidays in month
      const holidays = await Holiday.findAll({
        where: {
          date: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
        },
      });
      const holidayDates = holidays.map((h) =>
        moment(h.date).format("YYYY-MM-DD")
      );

      // Get approved leaves
      const leaves = await LeaveRequest.findAll({
        where: {
          userId,
          status: "approved",
          [Op.or]: [
            {
              startDate: {
                [Op.between]: [startDate.toDate(), endDate.toDate()],
              },
            },
            {
              endDate: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
            },
          ],
        },
      });
      const leaveDays = new Set();
      leaves.forEach((leave) => {
        let current = moment(leave.startDate);
        while (current <= moment(leave.endDate)) {
          leaveDays.add(current.format("YYYY-MM-DD"));
          current.add(1, "day");
        }
      });

      // Get attendances
      const attendances = await Attendance.findAll({
        where: {
          userId,
          date: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
        },
      });
      const attendanceMap = {};
      attendances.forEach((att) => {
        attendanceMap[moment(att.date).format("YYYY-MM-DD")] = att;
      });

      // Calculate
      let totalLateMin = 0;
      let totalExtraMin = 0;
      let totalAbsentDays = 0;
      let totalPresentDays = 0;
      let totalHalfDays = 0;
      let totalHolidays = holidayDates.length;
      let totalLeaves = leaveDays.size;
      let netPay = 0;

      // Loop through each day in month
      let currentDate = startDate.clone();
      let expectedWorkingDays = 0;
      while (currentDate <= endDate) {
        const dayStr = currentDate.format("YYYY-MM-DD");
        const isWeekend = currentDate.day() === 0 || currentDate.day() === 6;
        const isHoliday = holidayDates.includes(dayStr);

        if (!isWeekend && !isHoliday) {
          expectedWorkingDays++;
        }

        // Find effective salary for this day
        let daySalary = 0;
        for (let i = salaryHistories.length - 1; i >= 0; i--) {
          if (moment(salaryHistories[i].startDate) <= currentDate) {
            daySalary = salaryHistories[i].salary;
            break;
          }
        }
        if (!daySalary) daySalary = user.baseSalary || 0; // Fallback

        const dailyRate = daySalary / endDate.date(); // Simple: divide by calendar days, can adjust to expectedWorkingDays
        const hourlyRate = dailyRate / user.requiredDailyHours;
        const overtimeRate = hourlyRate * 1.5; // Assumption: 1.5x for overtime

        if (isWeekend || isHoliday) {
          // No deduction, but if extra work marked, pay overtime
          const att = attendanceMap[dayStr];
          if (att && att.extraMinutes > 0) {
            netPay += (att.extraMinutes / 60) * overtimeRate;
            totalExtraMin += att.extraMinutes;
          }
        } else {
          // Working day
          const isLeave = leaveDays.has(dayStr);
          const att = attendanceMap[dayStr];

          if (isLeave) {
            // Paid full (assumption: paid leave)
            netPay += dailyRate;
            // Count as present? No, but no deduction
          } else if (att) {
            let dayPay = dailyRate;
            if (att.isFullAbsent) {
              totalAbsentDays++;
              dayPay = 0;
            } else if (att.isHalfDay) {
              totalHalfDays++;
              dayPay = dailyRate / 2;
            } else {
              totalPresentDays++;
            }
            // Late deduction
            const lateHours = att.lateMinutes / 60;
            dayPay -= lateHours * hourlyRate;
            totalLateMin += att.lateMinutes;

            // Extra pay
            const extraHours = att.extraMinutes / 60;
            dayPay += extraHours * overtimeRate;
            totalExtraMin += att.extraMinutes;

            netPay += dayPay;
          } else {
            // No record: absent
            totalAbsentDays++;
          }
        }

        currentDate.add(1, "day");
      }

      // Deductions (additional if needed, but included in dayPay)
      const deductions = totalAbsentDays * (user.baseSalary / endDate.date()); // Example

      const details = {
        baseSalary: user.baseSalary,
        totalLateMin,
        totalExtraMin,
        totalAbsentDays,
        totalPresentDays,
        totalHalfDays,
        totalHolidays,
        totalLeaves,
        expectedWorkingDays,
        deductions,
        netPay: Math.max(0, netPay), // Ensure non-negative
        // For PDF: add more like daily breakdowns if needed
      };

      return {
        status: true,
        message: "Salary details calculated",
        data: details,
      };
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

  // Extra: Get release history
  async getReleaseHistory(userId) {
    try {
      const history = await PayrollRelease.findAll({
        where: { userId },
        order: [["month", "DESC"]],
      });
      return { status: true, data: history };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },
};

module.exports = PayrollService;
