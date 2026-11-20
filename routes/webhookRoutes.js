const express = require("express");
const router = express.Router();
const { handlePaymentWebhook } = require("../controllers/webhookController");

// IMPORTANT: Use express.raw() specifically on the webhook route
// so HMAC signature verification matches the exact raw payload bytes.
router.post(
  "/payment",
  express.raw({ type: "application/json" }),
  handlePaymentWebhook
);

module.exports = router;