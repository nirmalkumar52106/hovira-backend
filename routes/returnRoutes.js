
const router = require("express").Router();

const returnController = require("../controllers/returnController");
const { protectCustomer } = require("../middleware/auth");
const uploadReturnImages = require("../middleware/uploadReturnImages");

// Customer return request
router.post(
  "/",
  protectCustomer,
  uploadReturnImages.array("photos", 5),
  returnController.createReturnRequest
);

// Customer cancellation request
router.post(
  "/cancellation",
  protectCustomer,
  returnController.createCancellationRequest
);

// Customer's all requests
router.get(
  "/my",
  protectCustomer,
  returnController.myReturnRequests
);

// Single request details
router.get(
  "/my/:id",
  protectCustomer,
  returnController.getMyReturnRequest
);

// Cancel a submitted request
router.patch(
  "/my/:id/cancel",
  protectCustomer,
  returnController.cancelMyReturnRequest
);

module.exports = router;
