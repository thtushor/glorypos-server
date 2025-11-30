// New file: LoanService.js - Handles all loan management logic
const sequelize = require("../db");
const { EmployeeLoan, LoanPayment, UserRole } = require("../entity");

const LoanService = {
  async createLoan(adminId, {
    employeeId,
    principalAmount,
    interestRate,
    monthlyEMI,
  }) {
    const transaction = await sequelize.transaction();
    try {
      const user = await UserRole.findOne({
        where: { id: employeeId, parentUserId: adminId },
        transaction,
      });
      if (!user) {
        throw new Error("Employee not found under your management.");
      }

      const totalPayableAmount =
        parseFloat(principalAmount) * (1 + parseFloat(interestRate));

      const loan = await EmployeeLoan.create(
        {
          employeeId,
          principalAmount,
          interestRate,
          totalPayableAmount,
          monthlyEMI,
          remainingBalance: totalPayableAmount,
        },
        { transaction }
      );

      await transaction.commit();
      return {
        status: true,
        message: "Loan created successfully.",
        data: loan,
      };
    } catch (error) {
      await transaction.rollback();
      return { status: false, message: error.message };
    }
  },

  async makeManualPayment(adminId, { loanId, employeeId, paidAmount }) {
    const transaction = await sequelize.transaction();
    try {
      const loan = await EmployeeLoan.findOne({
        where: { id: loanId, employeeId, status: "ACTIVE" },
        transaction,
      });

      if (!loan) {
        throw new Error("Active loan not found for this employee.");
      }

      const newRemainingBalance =
        parseFloat(loan.remainingBalance) - parseFloat(paidAmount);
      if (newRemainingBalance < 0) {
        throw new Error("Payment exceeds remaining balance.");
      }

      await LoanPayment.create(
        {
          loanId,
          employeeId,
          paidAmount,
          paidBy: adminId,
        },
        { transaction }
      );

      loan.remainingBalance = newRemainingBalance;
      if (newRemainingBalance === 0) {
        loan.status = "COMPLETED";
      }

      await loan.save({ transaction });
      await transaction.commit();

      return {
        status: true,
        message: "Payment recorded successfully.",
        data: loan,
      };
    } catch (error) {
      await transaction.rollback();
      return { status: false, message: error.message };
    }
  },

  async getRemainingBalance(employeeId) {
    try {
      const loans = await EmployeeLoan.findAll({
        where: { employeeId, status: "ACTIVE" },
      });

      if (!loans || loans.length === 0) {
        return {
          status: true,
          message: "No active loans found for this employee.",
          data: { remainingBalance: 0 },
        };
      }

      const totalRemainingBalance = loans.reduce(
        (acc, loan) => acc + parseFloat(loan.remainingBalance),
        0
      );

      return {
        status: true,
        message: "Remaining balance fetched.",
        data: { remainingBalance: totalRemainingBalance, loans },
      };
    } catch (error) {
      return { status: false, message: error.message };
    }
  },
};

module.exports = LoanService;
