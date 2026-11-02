const express = require("express");
const router = express.Router();

const {
  getNewsletterSubscribers,
} = require("../controllers/newsletterController");

// Apne existing admin authentication middleware yahan import karein.
// Example:
const { protectAdmin, protectCustomer } = require('../middleware/auth'); 

router.get(
  "/subscribers",
  protectAdmin,
  getNewsletterSubscribers
);

module.exports = router;