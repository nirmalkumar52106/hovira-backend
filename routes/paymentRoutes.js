const router = require("express").Router();

const {
  createRazorpayOrder,
  verifyRazorpayPayment,
} = require("../controllers/razorpayController");

const { protectCustomer } = require("../middleware/auth");

router.post("/razorpay/create-order", protectCustomer, createRazorpayOrder);
router.post("/razorpay/verify", protectCustomer, verifyRazorpayPayment);

module.exports = router;