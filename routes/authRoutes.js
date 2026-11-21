
const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const c = require("../controllers/authController");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Try again later.",
  },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many OTP attempts. Please try again later.",
  },
});

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many OTP resend requests. Please try again later.",
  },
});

// Customer routes
router.post("/customers/register", authLimiter, c.registerCustomer);
router.post("/customers/login", authLimiter, c.loginCustomer);

// Admin routes
router.post("/admin/login", authLimiter, c.loginAdmin);
router.post("/admin/verify-otp", otpLimiter, c.verifyAdminOtp);
router.post("/admin/resend-otp", resendLimiter, c.resendAdminOtp);

module.exports = router;
