
const router = require("express").Router();

const {
  protectAdmin,
} = require("../middleware/auth");

const controller = require("../controllers/adminReturnRefundController");
const refundController = require("../controllers/adminReturnRefundController");

// All routes require admin authentication
router.use(protectAdmin);

// Get all return/refund requests
router.get("/", controller.adminListReturnRequests);

// Get single request
router.get("/:id", controller.adminGetReturnRequest);

// Approve / reject
router.patch("/:id/review", controller.reviewReturnRequest);

// Local pickup management
router.patch("/:id/pickup", controller.updateReturnPickup);

// Product inspection
router.patch("/:id/inspection", controller.updateReturnInspection);

// Process refund
router.patch("/:id/refund", refundController.processReturnRefund);

module.exports = router;
