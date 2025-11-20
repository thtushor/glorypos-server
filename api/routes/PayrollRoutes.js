// New file: PayrollRoutes.js - API endpoints
const express = require("express");
const { AuthService, PayrollService } = require("../services");
const requestHandler = require("../utils/requestHandler");
const { addShopAccess } = require("../middleware/shopAccessMiddleware"); // Assume similar auth

const router = express.Router();
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

// Create leave request (case 6)
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

// === GET LEAVE HISTORY (Admin) ===
router.get(
  "/leave/history",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getLeaveHistory(req.user.id, req.query);
    res.status(result.status ? 200 : 400).json(result);
  })
);

// Update leave status (case 6)
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

// Add holiday (case 7)
router.post(
  "/holiday",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.addHoliday(req.user.id, req.body);
    res.status(result.status ? 201 : 400).json(result);
  })
);

// Get holidays (case 7)
router.get(
  "/holidays",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getHolidays(req.query);
    res.status(result.status ? 200 : 400).json(result);
  })
);

// Promotion (case 8)
router.post(
  "/promotion",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.promoteUser(req.user.id, req.body);
    res.status(result.status ? 200 : 400).json(result);
  })
);
// GET promotion history for ONE employee (any admin)
router.get(
  "/promotion/history/:userId",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getPromotionHistory(req.params.userId);
    res.status(result.status ? 200 : 400).json(result);
  })
);

// GET promotion history for ALL employees (any admin)
router.get(
  "/promotion/history",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getAllPromotionHistory(req.query);
    res.status(result.status ? 200 : 400).json(result);
  })
);

// Get salary details (case 5)
router.post(
  "/salary/details",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const { userId, startDate, endDate } = req.body;
    const adminId = req.user.id;

    const result = await PayrollService.getSalaryDetailsInRange(
      adminId,
      userId,
      startDate,
      endDate
    );

    res.status(result.status ? 200 : 400).json(result);
  })
);

// Release salary (extra)
router.post(
  "/release",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const { userId, month, releasedAmount, details } = req.body;
    const result = await PayrollService.releaseSalary(
      req.user.id,
      userId,
      month,
      releasedAmount,
      details
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

// Get full release history
router.get(
  "/release/history",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getFullReleaseHistory(req.query);
    res.status(result.status ? 200 : 400).json(result);
  })
);

// Get release history (extra)
router.get(
  "/history/:userId",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await PayrollService.getReleaseHistory(req.params.userId);
    res.status(result.status ? 200 : 400).json(result);
  })
);

module.exports = router;
