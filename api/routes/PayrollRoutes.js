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
      req.accessibleShopIds,
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
      req.accessibleShopIds,
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
      req.accessibleShopIds,
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
      req.accessibleShopIds,
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
    const result = await PayrollService.getLeaveHistory(req.accessibleShopIds, req.query);
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.put(
  "/leave/:id",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.updateLeaveStatus(
      req.accessibleShopIds,
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
    const result = await PayrollService.promoteUser(req.accessibleShopIds, req.body);
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
  "/details",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const { userId, salaryMonth, ...options } = req.body;
    const result = await PayrollService.calculateMonthlyPayrollDetails(
      req?.accessibleShopIds || [],
      userId,
      salaryMonth,
      options
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

// Generate monthly payroll for an employee
router.post(
  "/payroll/generate",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.generateMonthlyPayroll(
      req.accessibleShopIds,
      req.body
    );
    res.status(result.status ? 201 : 400).json(result);
  })
);

// Release a specific payroll (Full or Partial)
router.put(
  "/payroll/release/:id",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const { paymentType = "FULL", partialAmount } = req.body;
    const result = await PayrollService.releasePayroll(
      req.accessibleShopIds,
      req.user.id,
      req.params.id,
      paymentType,
      partialAmount
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
      req.accessibleShopIds || [],
      req.query
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.post(
  "/advance-salary/:id/status",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const { status } = req.body;
    const result = await PayrollService.updateAdvanceSalaryStatus(
      req?.accessibleShopIds || [],
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
      req.accessibleShopIds,
      req.params.id
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);


module.exports = router;
