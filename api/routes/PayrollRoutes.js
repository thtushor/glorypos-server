// New file: PayrollRoutes.js - API endpoints
const express = require("express");
const {
  AuthService,
  PayrollService,
  BulkPayrollService, // Keep if BulkPayrollService is still used elsewhere
} = require("../services");
const requestHandler = require("../utils/requestHandler");
const { addShopAccess } = require("../middleware/shopAccessMiddleware"); // Assume similar auth

const router = express.Router();

// === ATTENDANCE ROUTES (Existing) ===
router.post(
  "/attendance/present/multiple",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.markMultiplePresent(
      req.user.id,
      req.body
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.post(
  "/attendance/absent/multiple",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.markMultipleAbsent(
      req.user.id,
      req.body
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.post(
  "/attendance/:userId",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.updateAttendance(
      req.user.id,
      req.params.userId,
      req.body
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.delete(
  "/attendance/:userId",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const { date } = req.query;
    const result = await PayrollService.deleteAttendance(
      req.user.id,
      req.params.userId,
      date
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

// === LEAVE REQUEST ROUTES (Existing) ===
router.post(
  "/leave",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.createLeaveRequest(
      req.user.id,
      req.body
    );
    res.status(result.status ? 201 : 400).json(result);
  })
);

router.get(
  "/leave/history",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getLeaveHistory(req.user.id, req.query);
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.put(
  "/leave/:id",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.updateLeaveStatus(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

// === HOLIDAY ROUTES (Existing) ===
router.post(
  "/holiday",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.addHoliday(req.user.id, req.body);
    res.status(result.status ? 201 : 400).json(result);
  })
);

router.get(
  "/holidays",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getHolidays(req.query);
    res.status(result.status ? 200 : 400).json(result);
  })
);

// === PROMOTION ROUTES (Existing) ===
router.post(
  "/promotion",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.promoteUser(req.user.id, req.body);
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.get(
  "/promotion/history/:userId",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getPromotionHistory(req.params.userId);
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.get(
  "/promotion/history",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getAllPromotionHistory(req.query);
    res.status(result.status ? 200 : 400).json(result);
  })
);

// === NEW PAYROLL ROUTES ===

// Get payroll calculation details (preview for a month)
router.post(
  "/payroll/details",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const { userId, salaryMonth } = req.body;
    const adminId = req.user.id;
    const result = await PayrollService.calculateMonthlyPayrollDetails(
      adminId,
      userId,
      salaryMonth
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);



// Release full payroll
router.post(
  "/payroll/release",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.releasePayrollForAllEmployeeByMonth(
      req.user.id
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

// Get full payroll release history (admin view)
router.get(
  "/payroll/history",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getFullReleaseHistory(req.query);
    res.status(result.status ? 200 : 400).json(result);
  })
);

// Get single user payroll release history
router.get(
  "/payroll/history/:userId",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getReleaseHistory(req.params.userId);
    res.status(result.status ? 200 : 400).json(result);
  })
);

// === ADVANCE SALARY ROUTES ===
router.post(
  "/advance-salary",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.createAdvanceSalary(
      req.user.id,
      req.body
    );
    res.status(result.status ? 201 : 400).json(result);
  })
);

router.get(
  "/advance-salary",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getAdvanceSalaries(
      req.user.id,
      req.query
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.put(
  "/advance-salary/:id/status",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const { status } = req.body;
    const result = await PayrollService.updateAdvanceSalaryStatus(
      req.user.id,
      req.params.id,
      status
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.delete(
  "/advance-salary/:id",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.deleteAdvanceSalary(
      req.user.id,
      req.params.id
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

// === PAYROLL FINE ROUTES ===
router.post(
  "/payroll-fine",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.createPayrollFine(
      req.user.id,
      req.body
    );
    res.status(result.status ? 201 : 400).json(result);
  })
);

router.get(
  "/payroll-fine",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getPayrollFines(
      req.user.id,
      req.query
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.delete(
  "/payroll-fine/:id",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.deletePayrollFine(
      req.user.id,
      req.params.id
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

module.exports = router;
