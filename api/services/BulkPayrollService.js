// New file: BulkPayrollService.js - Handles bulk payroll operations
const sequelize = require("../db");
const { Op } = require("sequelize");
const moment = require("moment");
const {
  UserRole,
  StuffCommission,
  PayrollRelease,
  EmployeeLoan,
  LoanPayment,
} = require("../entity");
const PayrollService = require("./PayrollService");

const BulkPayrollService = {
  async releaseSalaryForAll(adminId, { startDate, endDate }) {
    const transaction = await sequelize.transaction();
    try {
      const employees = await UserRole.findAll({
        where: { parentUserId: adminId, status: "active" },
        transaction,
      });

      if (!employees.length) {
        throw new Error("No active employees found.");
      }

      const results = [];
      for (const employee of employees) {
        const salaryDetails = await PayrollService.getSalaryDetailsInRange(
          adminId,
          employee.id,
          startDate,
          endDate
        );

        if (!salaryDetails.status) {
          throw new Error(
            `Failed to calculate salary for ${employee.fullName}: ${salaryDetails.message}`
          );
        }

        const commissions = await StuffCommission.findAll({
          where: {
            UserRoleId: employee.id,
            createdAt: {
              [Op.gte]: moment(startDate).toDate(),
              [Op.lte]: moment(endDate).toDate(),
            },
          },
          transaction,
        });

        const totalCommission = commissions.reduce(
          (acc, comm) => acc + parseFloat(comm.commissionAmount),
          0
        );
        const result = await PayrollService.releaseFullSalary(adminId, {
          employeeId: employee.id,
          startDate,
          endDate,
        });
        results.push(result);
      }

      await transaction.commit();
      return {
        status: true,
        message: "Successfully released salaries for all employees.",
        data: results,
      };
    } catch (error) {
      await transaction.rollback();
      return { status: false, message: error.message };
    }
  },
};

module.exports = BulkPayrollService;
