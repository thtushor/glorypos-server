const express = require("express");
const router = express.Router();

const { StuffCommissionService, AuthService } = require("../services");
const requestHandler = require("../utils/requestHandler");
const { addShopAccess } = require("../middleware/shopAccessMiddleware");

router.get(
  "/",
  AuthService.authenticate,
  addShopAccess,
  requestHandler(null, async (req, res) => {
    const result = await StuffCommissionService.getAll(
      req.accessibleShopIds,
      req.query
    );

    res.status(result.status ? 200 : 400).json(result);
  })
);

module.exports = router;


