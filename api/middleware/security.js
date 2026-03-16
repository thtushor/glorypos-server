const rateLimit = require("express-rate-limit");

/**
 * Global rate limiter to prevent DDoS and brute force attacks.
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
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
  max: 20, // Limit each IP to 20 auth requests per window
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
