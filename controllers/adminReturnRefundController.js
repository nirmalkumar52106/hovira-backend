
const mongoose = require("mongoose");
const Razorpay = require("razorpay");

const Order = require("../models/Order");
const ReturnRefund = require("../models/ReturnRefund");

// =============================================
// RAZORPAY CONFIGURATION
// =============================================

const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

const fail = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const validId = (id) => mongoose.isValidObjectId(id);

// =============================================
// 1. ADMIN: GET ALL RETURN REQUESTS
// GET /api/returns/admin
// =============================================

exports.adminListReturnRequests = async (req, res) => {
  try {
    const {
      status,
      requestType,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const currentPage = Math.max(1, Number(page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(limit) || 10));

    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (requestType && requestType !== "all") {
      filter.requestType = requestType;
    }

    if (search && String(search).trim()) {
      const searchValue = String(search).trim();

      filter.$or = [
        { requestNumber: { $regex: searchValue, $options: "i" } },
        { reason: { $regex: searchValue, $options: "i" } },
      ];

      // Search by MongoDB ObjectId if valid
      if (validId(searchValue)) {
        filter.$or.push(
          { _id: searchValue },
          { order: searchValue },
          { customer: searchValue }
        );
      }
    }

    const [requests, total] = await Promise.all([
      ReturnRefund.find(filter)
        .populate("customer", "name email mobile")
        .populate("order", "orderNumber total status paymentStatus")
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * perPage)
        .limit(perPage)
        .lean(),

      ReturnRefund.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error("Admin List Return Requests:", error);
    return fail(res, 500, "Unable to fetch return requests.");
  }
};

// =============================================
// 2. ADMIN: GET SINGLE RETURN REQUEST
// GET /api/returns/admin/:id
// =============================================

exports.adminGetReturnRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return fail(res, 400, "Invalid return request ID.");
    }

    const request = await ReturnRefund.findById(id)
      .populate("customer", "name email mobile address")
      .populate("order")
      .populate("reviewedBy", "name email")
      .populate("refund.approvedBy", "name email")
      .populate("inspection.inspectedBy", "name email")
      .populate("pickup.assignedTo", "name email mobile");

    if (!request) {
      return fail(res, 404, "Return request not found.");
    }

    return res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Admin Get Return Request:", error);
    return fail(res, 500, "Unable to fetch return request.");
  }
};

// =============================================
// 3. ADMIN: APPROVE / REJECT REQUEST
// PATCH /api/returns/admin/:id/review
// =============================================

exports.reviewReturnRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote = "" } = req.body;

    if (!validId(id)) {
      return fail(res, 400, "Invalid return request ID.");
    }

    if (!["approved", "rejected"].includes(status)) {
      return fail(res, 400, "Status must be approved or rejected.");
    }

    const request = await ReturnRefund.findById(id);

    if (!request) {
      return fail(res, 404, "Return request not found.");
    }

    if (
      ["refunded", "refund_processing", "cancelled"].includes(
        request.status
      )
    ) {
      return fail(res, 400, "This request cannot be reviewed now.");
    }

    if (
      !["requested", "under_review"].includes(request.status)
    ) {
      return fail(
        res,
        400,
        "This request has already been reviewed or processed."
      );
    }

    request.status = status;
    request.adminNote = String(adminNote).trim();
    request.reviewedBy = req.admin._id;
    request.reviewedAt = new Date();

    if (status === "rejected") {
      request.rejectedAt = new Date();
    }

    request.statusHistory.push({
      status,
      note:
        String(adminNote).trim() ||
        `Request ${status} by admin.`,
      changedBy: req.admin._id,
      changedAt: new Date(),
    });

    await request.save();

    return res.status(200).json({
      success: true,
      message: `Return request ${status} successfully.`,
      data: request,
    });
  } catch (error) {
    console.error("Admin Review Return Request:", error);
    return fail(res, 500, "Unable to review return request.");
  }
};

// =============================================
// 4. ADMIN: LOCAL PICKUP MANAGEMENT
// PATCH /api/returns/admin/:id/pickup
// =============================================

exports.updateReturnPickup = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      employeeName,
      employeePhone,
      scheduledDate,
      scheduledTime,
      status,
      note = "",
    } = req.body;

    if (!validId(id)) {
      return fail(res, 400, "Invalid return request ID.");
    }

    const request = await ReturnRefund.findById(id);

    if (!request) {
      return fail(res, 404, "Return request not found.");
    }

    if (
      !["approved", "pickup_scheduled", "picked_up"].includes(
        request.status
      )
    ) {
      return fail(
        res,
        400,
        "Approve the request before managing pickup."
      );
    }

    const allowedPickupStatuses = [
      "not_scheduled",
      "scheduled",
      "assigned",
      "completed",
      "failed",
    ];

    if (status && !allowedPickupStatuses.includes(status)) {
      return fail(res, 400, "Invalid pickup status.");
    }

    request.pickup = request.pickup || {};

    if (employeeName !== undefined) {
      request.pickup.employeeName = employeeName;
    }

    if (employeePhone !== undefined) {
      request.pickup.employeePhone = employeePhone;
    }

    if (scheduledDate !== undefined) {
      request.pickup.scheduledDate = scheduledDate;
    }

    if (scheduledTime !== undefined) {
      request.pickup.scheduledTime = scheduledTime;
    }

    if (note !== undefined) {
      request.pickup.note = note;
    }

    if (status) {
      request.pickup.status = status;

      if (status === "completed") {
        request.pickup.completedAt = new Date();
        request.status = "picked_up";
      } else if (status === "scheduled" || status === "assigned") {
        request.status = "pickup_scheduled";
      }

      request.statusHistory.push({
        status: request.status,
        note:
          String(note).trim() ||
          `Pickup status updated to ${status}.`,
        changedBy: req.admin._id,
        changedAt: new Date(),
      });
    }

    await request.save();

    return res.status(200).json({
      success: true,
      message: "Pickup information updated successfully.",
      data: request,
    });
  } catch (error) {
    console.error("Admin Update Pickup:", error);
    return fail(res, 500, "Unable to update pickup information.");
  }
};

// =============================================
// 5. ADMIN: PRODUCT INSPECTION
// PATCH /api/returns/admin/:id/inspection
// =============================================

exports.updateReturnInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note = "" } = req.body;

    if (!validId(id)) {
      return fail(res, 400, "Invalid return request ID.");
    }

    if (!["passed", "failed"].includes(status)) {
      return fail(res, 400, "Inspection status must be passed or failed.");
    }

    const request = await ReturnRefund.findById(id);

    if (!request) {
      return fail(res, 404, "Return request not found.");
    }

    if (request.requestType !== "return") {
      return fail(
        res,
        400,
        "Product inspection is only applicable to return requests."
      );
    }

    if (
      !["picked_up", "received", "inspection_passed", "inspection_failed"].includes(
        request.status
      )
    ) {
      return fail(
        res,
        400,
        "Product must be picked up or received before inspection."
      );
    }

    request.inspection = request.inspection || {};

    request.inspection.status = status;
    request.inspection.note = String(note).trim();
    request.inspection.inspectedBy = req.admin._id;
    request.inspection.inspectedAt = new Date();

    request.status =
      status === "passed"
        ? "inspection_passed"
        : "inspection_failed";

    request.statusHistory.push({
      status: request.status,
      note:
        String(note).trim() ||
        `Product inspection ${status}.`,
      changedBy: req.admin._id,
      changedAt: new Date(),
    });

    await request.save();

    return res.status(200).json({
      success: true,
      message: `Product inspection ${status} successfully.`,
      data: request,
    });
  } catch (error) {
    console.error("Admin Product Inspection:", error);
    return fail(res, 500, "Unable to update product inspection.");
  }
};

// =============================================
// REFUND HELPERS
// =============================================

// Reserve refund amount against order total.
// Order schema must contain refundedAmount and refundsReservedAmount.

async function reserveOrderRefund(orderId, amount) {
  return Order.findOneAndUpdate(
    {
      _id: orderId,
      $expr: {
        $lte: [
          {
            $add: [
              { $ifNull: ["$refundedAmount", 0] },
              { $ifNull: ["$refundsReservedAmount", 0] },
              amount,
            ],
          },
          "$total",
        ],
      },
    },
    {
      $inc: {
        refundsReservedAmount: amount,
      },
    },
    { new: true }
  );
}

// Release reserved amount.
// If completed=true, add amount to refundedAmount.

async function settleOrderRefund(orderId, amount, completed) {
  const update = {
    $inc: {
      refundsReservedAmount: -amount,
    },
  };

  if (completed) {
    update.$inc.refundedAmount = amount;
  }

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      refundsReservedAmount: { $gte: amount },
    },
    update,
    { new: true }
  );

  if (!order) {
    throw new Error("Unable to reconcile reserved refund amount.");
  }

  if (completed) {
    order.paymentStatus =
      roundMoney(order.refundedAmount || 0) >=
      roundMoney(order.total || 0)
        ? "refunded"
        : "partially_refunded";

    await order.save();
  }

  return order;
}

// =============================================
// 6. ADMIN: PROCESS RETURN / CANCELLATION REFUND
// PATCH /api/returns/admin/:id/refund
// =============================================

exports.processReturnRefund = async (req, res) => {
  let lockedRequest = null;
  let orderId = null;
  let reservedAmount = 0;
  let reservationCreated = false;
  let providerSubmitted = false;

  try {
    const { id } = req.params;

    if (!validId(id)) {
      return fail(res, 400, "Invalid return request ID.");
    }

    const {
      eligibleAmount,
      refundPercentage,
      packingCharge = 0,
      deliveryCharge = 0,
      pickupCharge = 0,
      otherDeduction = 0,
      calculationNote = "",
      refundMethod,
      paymentReference = "",
    } = req.body;

    const eligible = Number(eligibleAmount);
    const percentage = Number(refundPercentage);

    const charges = {
      packingCharge: Number(packingCharge),
      deliveryCharge: Number(deliveryCharge),
      pickupCharge: Number(pickupCharge),
      otherDeduction: Number(otherDeduction),
    };

    if (
      !Number.isFinite(eligible) ||
      eligible <= 0 ||
      !Number.isFinite(percentage) ||
      percentage < 0 ||
      percentage > 100
    ) {
      return fail(
        res,
        400,
        "Enter a valid eligible amount and refund percentage."
      );
    }

    if (
      Object.values(charges).some(
        (value) => !Number.isFinite(value) || value < 0
      )
    ) {
      return fail(res, 400, "Invalid deduction amount.");
    }

    if (!["razorpay", "upi", "bank"].includes(refundMethod)) {
      return fail(res, 400, "Select a valid refund method.");
    }

    if (refundMethod === "razorpay" && !razorpay) {
      return fail(res, 500, "Razorpay credentials are not configured.");
    }

    const request = await ReturnRefund.findById(id);

    if (!request) {
      return fail(res, 404, "Return request not found.");
    }

    if (
      request.requestType === "return" &&
      request.inspection?.status !== "passed"
    ) {
      return fail(
        res,
        400,
        "Product inspection must pass before refund."
      );
    }

    if (
      request.requestType === "return" &&
      request.status !== "inspection_passed"
    ) {
      return fail(
        res,
        400,
        "Return request is not ready for refund."
      );
    }

    if (
      request.requestType === "cancellation" &&
      request.status !== "approved"
    ) {
      return fail(
        res,
        400,
        "Approve the cancellation request before refund."
      );
    }

    if (
      [
        "refunded",
        "refund_processing",
        "cancelled",
        "rejected",
      ].includes(request.status) ||
      ["processing", "completed"].includes(request.refund?.status)
    ) {
      return fail(
        res,
        409,
        "This request already has a refund in progress or completed."
      );
    }

    const order = await Order.findById(request.order);

    if (!order) {
      return fail(res, 404, "Original order not found.");
    }

    if (eligible > Number(order.total)) {
      return fail(
        res,
        400,
        "Eligible refund amount cannot exceed the order total."
      );
    }

    const deductionTotal = roundMoney(
      Object.values(charges).reduce((sum, value) => sum + value, 0)
    );

    const percentageAmount = roundMoney(
      (eligible * percentage) / 100
    );

    const finalAmount = roundMoney(
      Math.max(0, percentageAmount - deductionTotal)
    );

    if (finalAmount <= 0) {
      return fail(
        res,
        400,
        "Calculated refund amount must be greater than zero."
      );
    }

    if (refundMethod === "razorpay") {
      if (!order.razorpayPaymentId) {
        return fail(
          res,
          400,
          "Razorpay payment ID is not available for this order."
        );
      }

      if (!["paid", "partially_refunded"].includes(order.paymentStatus)) {
        return fail(
          res,
          400,
          "Only captured Razorpay payments can be refunded."
        );
      }
    }

    if (
      ["upi", "bank"].includes(refundMethod) &&
      !String(paymentReference).trim()
    ) {
      return fail(
        res,
        400,
        "Enter the UPI or bank transaction reference after making the transfer."
      );
    }

    // Lock request before initiating refund.
    lockedRequest = await ReturnRefund.findOneAndUpdate(
      {
        _id: id,
        status: request.status,
        "refund.status": { $in: ["pending", "failed"] },
      },
      {
        $set: {
          status: "refund_processing",
          "refund.status": "processing",
          "refund.eligibleAmount": eligible,
          "refund.refundPercentage": percentage,
          "refund.refundAmount": finalAmount,
          "refund.deductionAmount": deductionTotal,
          "refund.packingCharge": charges.packingCharge,
          "refund.deliveryCharge": charges.deliveryCharge,
          "refund.pickupCharge": charges.pickupCharge,
          "refund.otherDeduction": charges.otherDeduction,
          "refund.calculationNote": calculationNote,
          "refund.refundMethod": refundMethod,
          "refund.approvedBy": req.admin._id,
          "refund.approvedAt": new Date(),
        },
        $push: {
          statusHistory: {
            status: "refund_processing",
            note: "Admin initiated refund processing.",
            changedBy: req.admin._id,
            changedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!lockedRequest) {
      return fail(
        res,
        409,
        "Another admin action may already be processing this refund."
      );
    }

    orderId = order._id;
    reservedAmount = finalAmount;

    // Reserve amount before calling payment provider.
    const reservedOrder = await reserveOrderRefund(
      orderId,
      finalAmount
    );

    if (!reservedOrder) {
      throw new Error(
        "Refund exceeds the remaining refundable order amount."
      );
    }

    reservationCreated = true;

    // =========================================
    // RAZORPAY ONLINE REFUND
    // =========================================

    if (refundMethod === "razorpay") {
      const razorpayRefund = await razorpay.payments.refund(
        order.razorpayPaymentId,
        {
          amount: Math.round(finalAmount * 100),
          notes: {
            orderId: String(order._id),
            orderNumber: String(order.orderNumber || ""),
            returnRequestId: String(lockedRequest._id),
            requestNumber: String(lockedRequest.requestNumber || ""),
            adminId: String(req.admin._id),
            reason: String(
              calculationNote || "HOVIRA return/refund"
            ),
          },
        }
      );

      // Provider accepted the refund.
      // Do not release reservation if later database saving fails.
      providerSubmitted = true;

      lockedRequest.refund.razorpayRefundId = razorpayRefund.id;
      lockedRequest.refund.paymentReference = razorpayRefund.id;

      if (razorpayRefund.status === "processed") {
        await settleOrderRefund(orderId, finalAmount, true);
        reservationCreated = false;

        lockedRequest.refund.status = "completed";
        lockedRequest.refund.processedAt = new Date();
        lockedRequest.status = "refunded";

        lockedRequest.statusHistory.push({
          status: "refunded",
          note: `Razorpay refund processed. Refund ID: ${razorpayRefund.id}`,
          changedBy: req.admin._id,
          changedAt: new Date(),
        });
      } else {
        // Keep reservation until Razorpay confirms final status.
        lockedRequest.refund.status = "processing";
        lockedRequest.status = "refund_processing";

        lockedRequest.statusHistory.push({
          status: "refund_processing",
          note: `Razorpay refund submitted. Refund ID: ${razorpayRefund.id}. Provider status: ${razorpayRefund.status}`,
          changedBy: req.admin._id,
          changedAt: new Date(),
        });
      }

      await lockedRequest.save();

      return res.status(200).json({
        success: true,
        message:
          razorpayRefund.status === "processed"
            ? "Razorpay refund processed successfully."
            : "Razorpay refund submitted and is awaiting confirmation.",
        data: {
          request: lockedRequest,
          razorpayRefund,
        },
      });
    }

    // =========================================
    // MANUAL UPI / BANK REFUND
    // =========================================
    // Actual bank/UPI transfer must be completed
    // before calling this API.

    lockedRequest.refund.paymentReference = String(
      paymentReference
    ).trim();

    await settleOrderRefund(orderId, finalAmount, true);
    reservationCreated = false;

    lockedRequest.refund.status = "completed";
    lockedRequest.refund.processedAt = new Date();
    lockedRequest.status = "refunded";

    lockedRequest.statusHistory.push({
      status: "refunded",
      note: `Manual ${refundMethod.toUpperCase()} refund recorded. Reference: ${paymentReference}`,
      changedBy: req.admin._id,
      changedAt: new Date(),
    });

    await lockedRequest.save();

    return res.status(200).json({
      success: true,
      message: "Manual refund recorded successfully.",
      data: {
        request: lockedRequest,
        refundAmount: finalAmount,
      },
    });
  } catch (error) {
    console.error("Admin Refund Processing Error:", error);

    // Release reservation only if:
    // 1. Reservation was actually created.
    // 2. Payment provider has NOT accepted the refund.
    if (
      reservationCreated &&
      !providerSubmitted &&
      orderId &&
      reservedAmount > 0
    ) {
      try {
        await settleOrderRefund(orderId, reservedAmount, false);
        reservationCreated = false;
      } catch (releaseError) {
        console.error(
          "Refund reservation release error:",
          releaseError
        );
      }
    }

    // If Razorpay accepted the refund but database saving failed,
    // leave request in processing for reconciliation.
    if (lockedRequest && !providerSubmitted) {
      try {
        lockedRequest.refund.status = "failed";
        lockedRequest.status = "refund_approved";

        lockedRequest.statusHistory.push({
          status: "refund_approved",
          note: "Refund processing failed. Admin review is required.",
          changedBy: req.admin?._id || null,
          changedAt: new Date(),
        });

        await lockedRequest.save();
      } catch (saveError) {
        console.error("Refund failure save error:", saveError);
      }
    }

    return fail(
      res,
      500,
      error.message || "Unable to process refund."
    );
  }
};
