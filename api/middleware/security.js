const rateLimit = require("express-rate-limit");

/**
 * Global rate limiter to prevent DDoS and brute force attacks.
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased to 1000 for dashboard image heavy loads
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
});

/**
 * Stricter rate limiter for authentication-related endpoints.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Increased to 50
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: false,
    message: "Too many authentication attempts, please try again after 15 minutes",
  },
});

module.exports = {
  limiter,
  authLimiter,
};
