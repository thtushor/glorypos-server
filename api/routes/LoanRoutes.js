// New file: LoanRoutes.js - API endpoints for loan management
const express = require("express");
const { AuthService, LoanService } = require("../services");
const requestHandler = require("../utils/requestHandler");
const { addShopAccess } = require("../middleware/shopAccessMiddleware");

const router = express.Router();

router.post(
  "/create",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await LoanService.createLoan(req.user.id, req.body);
    res.status(result.status ? 201 : 400).json(result);
  })
);

router.post(
  "/pay",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await LoanService.makeManualPayment(req.user.id, req.body);
    res.status(result.status ? 200 : 400).json(result);
  })
);

router.get(
  "/remaining/:employeeId",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await LoanService.getRemainingBalance(
      req.params.employeeId
    );
    res.status(result.status ? 200 : 400).json(result);
  })
);

module.exports = router;
