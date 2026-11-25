
const mongoose = require("mongoose");

const Order = require("../models/Order");
const ReturnRefund = require("../models/ReturnRefund");
const uploadReturnImage = require("../utils/uploadReturnImage");

// Generate unique request number
const generateRequestNumber = () => {
  return `RET-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
};

// Helper: send errors
const sendError = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message,
  });
};

// =====================================================
// 1. CUSTOMER: CREATE RETURN REQUEST
// POST /api/returns
// =====================================================

exports.createReturnRequest = async (req, res) => {
  try {
    const customerId = req.customer?._id;
    const { orderId, reason, description } = req.body;

    if (!customerId) {
      return sendError(res, 401, "Customer authentication required.");
    }

    if (!mongoose.isValidObjectId(orderId)) {
      return sendError(res, 400, "Invalid order ID.");
    }

    if (!reason || !reason.trim()) {
      return sendError(res, 400, "Please select a return reason.");
    }

    // Return request requires minimum 2 photos
    const files = req.files || [];

    if (files.length < 2) {
      return sendError(
        res,
        400,
        "Minimum 2 product proof photos are required."
      );
    }

    if (files.length > 5) {
      return sendError(res, 400, "Maximum 5 photos are allowed.");
    }

    // Get customer's order
    const order = await Order.findOne({
      _id: orderId,
      customer: customerId,
    });

    if (!order) {
      return sendError(res, 404, "Order not found.");
    }

    // Only delivered orders can be returned
    if (order.status !== "delivered") {
      return sendError(
        res,
        400,
        "Only delivered orders are eligible for return."
      );
    }

    // Items can be sent as JSON string in multipart/form-data
    let requestedItems = req.body.items;

    if (typeof requestedItems === "string") {
      try {
        requestedItems = JSON.parse(requestedItems);
      } catch {
        return sendError(res, 400, "Invalid items format.");
      }
    }

    if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
      return sendError(res, 400, "Please select products for return.");
    }

    // Combine duplicate product entries
    const combinedItems = new Map();

    for (const item of requestedItems) {
      if (!mongoose.isValidObjectId(item.product)) {
        return sendError(res, 400, "Invalid product ID.");
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        return sendError(res, 400, "Invalid return quantity.");
      }

      const productId = String(item.product);

      combinedItems.set(
        productId,
        (combinedItems.get(productId) || 0) + quantity
      );
    }

    // Check previous return requests for this order
    const previousRequests = await ReturnRefund.find({
      order: order._id,
      status: {
        $nin: ["rejected", "cancelled"],
      },
    }).select("items status");

    const alreadyRequested = new Map();

    for (const previous of previousRequests) {
      for (const item of previous.items || []) {
        const productId = String(item.product);

        alreadyRequested.set(
          productId,
          (alreadyRequested.get(productId) || 0) + item.quantity
        );
      }
    }

    // Validate requested quantities against original order
    const returnItems = [];

    for (const [productId, quantity] of combinedItems.entries()) {
      const orderItem = order.items.find(
        (item) => String(item.product) === productId
      );

      if (!orderItem) {
        return sendError(
          res,
          400,
          "Selected product does not belong to this order."
        );
      }

      const previouslyRequested = alreadyRequested.get(productId) || 0;
      const remainingQuantity = orderItem.quantity - previouslyRequested;

      if (quantity > remainingQuantity) {
        return sendError(
          res,
          400,
          `Only ${remainingQuantity} quantity is available for return for ${orderItem.name}.`
        );
      }

      const unitPrice = Number(orderItem.unitPrice);

      returnItems.push({
        product: orderItem.product,
        name: orderItem.name,
        image: orderItem.image || "",
        sku: orderItem.sku || "",
        quantity,
        unitPrice,
        lineTotal: Number((unitPrice * quantity).toFixed(2)),
      });
    }

    // Upload proof images to Cloudinary
    const proofImages = [];

    for (const file of files) {
      const uploaded = await uploadReturnImage(file.buffer);
      proofImages.push(uploaded);
    }

    // Create request
    const returnRequest = await ReturnRefund.create({
      requestNumber: generateRequestNumber(),
      order: order._id,
      customer: customerId,
      requestType: "return",
      items: returnItems,
      reason: reason.trim(),
      description: description || "",
      proofImages,
      status: "requested",
      statusHistory: [
        {
          status: "requested",
          note: "Return request submitted by customer.",
          changedBy: null,
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Return request submitted successfully. Admin will review it.",
      data: returnRequest,
    });
  } catch (error) {
    console.error("Create return request error:", error);

    return sendError(
      res,
      500,
      error.message || "Failed to submit return request."
    );
  }
};

// =====================================================
// 2. CUSTOMER: CREATE CANCELLATION REQUEST
// POST /api/returns/cancellation
// =====================================================

exports.createCancellationRequest = async (req, res) => {
  try {
    const customerId = req.customer?._id;
    const { orderId, reason, description } = req.body;

    if (!customerId) {
      return sendError(res, 401, "Customer authentication required.");
    }

    if (!mongoose.isValidObjectId(orderId)) {
      return sendError(res, 400, "Invalid order ID.");
    }

    if (!reason || !reason.trim()) {
      return sendError(res, 400, "Please provide a cancellation reason.");
    }

    const order = await Order.findOne({
      _id: orderId,
      customer: customerId,
    });

    if (!order) {
      return sendError(res, 404, "Order not found.");
    }

    // Customer can request cancellation before shipment
    if (!["pending", "confirmed"].includes(order.status)) {
      return sendError(
        res,
        400,
        "Cancellation request is not available for this order status."
      );
    }

    // Prevent duplicate active cancellation requests
    const existingRequest = await ReturnRefund.findOne({
      order: order._id,
      requestType: "cancellation",
      status: {
        $nin: ["rejected", "cancelled"],
      },
    });

    if (existingRequest) {
      return sendError(
        res,
        409,
        "A cancellation request already exists for this order."
      );
    }

    const cancellationRequest = await ReturnRefund.create({
      requestNumber: generateRequestNumber(),
      order: order._id,
      customer: customerId,
      requestType: "cancellation",
      items: [],
      reason: reason.trim(),
      description: description || "",
      proofImages: [],
      status: "requested",
      statusHistory: [
        {
          status: "requested",
          note: "Cancellation request submitted by customer.",
          changedBy: null,
        },
      ],
      refund: {
        status: order.paymentStatus === "paid"
          ? "pending"
          : "not_applicable",
      },
    });

    return res.status(201).json({
      success: true,
      message:
        "Cancellation request submitted. Admin will review your request.",
      data: cancellationRequest,
    });
  } catch (error) {
    console.error("Create cancellation request error:", error);

    return sendError(
      res,
      500,
      error.message || "Failed to submit cancellation request."
    );
  }
};

// =====================================================
// 3. CUSTOMER: GET MY RETURN REQUESTS
// GET /api/returns/my
// =====================================================

exports.myReturnRequests = async (req, res) => {
  try {
    const customerId = req.customer?._id;

    if (!customerId) {
      return sendError(res, 401, "Customer authentication required.");
    }

    const requests = await ReturnRefund.find({
      customer: customerId,
    })
      .populate("order", "orderNumber total status paymentStatus")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("My return requests error:", error);

    return sendError(res, 500, "Failed to fetch return requests.");
  }
};

// =====================================================
// 4. CUSTOMER: GET SINGLE RETURN REQUEST
// GET /api/returns/my/:id
// =====================================================

exports.getMyReturnRequest = async (req, res) => {
  try {
    const customerId = req.customer?._id;
    const { id } = req.params;

    if (!customerId) {
      return sendError(res, 401, "Customer authentication required.");
    }

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid request ID.");
    }

    const request = await ReturnRefund.findOne({
      _id: id,
      customer: customerId,
    }).populate("order", "orderNumber items total status paymentStatus");

    if (!request) {
      return sendError(res, 404, "Return request not found.");
    }

    return res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Get return request error:", error);

    return sendError(res, 500, "Failed to fetch request details.");
  }
};

// =====================================================
// 5. CUSTOMER: CANCEL THEIR REQUEST
// PATCH /api/returns/my/:id/cancel
// =====================================================

exports.cancelMyReturnRequest = async (req, res) => {
  try {
    const customerId = req.customer?._id;
    const { id } = req.params;

    if (!customerId) {
      return sendError(res, 401, "Customer authentication required.");
    }

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid request ID.");
    }

    const request = await ReturnRefund.findOne({
      _id: id,
      customer: customerId,
    });

    if (!request) {
      return sendError(res, 404, "Return request not found.");
    }

    // Do not allow cancellation after pickup or refund processing
    const allowedStatuses = ["requested", "under_review", "approved"];

    if (!allowedStatuses.includes(request.status)) {
      return sendError(
        res,
        400,
        "This request can no longer be cancelled."
      );
    }

    request.status = "cancelled";
    request.cancelledAt = new Date();

    request.statusHistory.push({
      status: "cancelled",
      note: "Request cancelled by customer.",
      changedBy: null,
    });

    await request.save();

    return res.status(200).json({
      success: true,
      message: "Request cancelled successfully.",
      data: request,
    });
  } catch (error) {
    console.error("Cancel return request error:", error);

    return sendError(res, 500, "Failed to cancel request.");
  }
};
