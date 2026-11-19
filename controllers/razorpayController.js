
const Razorpay = require("razorpay");
const crypto = require("crypto");

const Order = require("../models/Order");
const asyncHandler = require("../middleware/asyncHandler");
const { sendPaymentReceipt } = require("../utils/orderEmails");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. Create Razorpay order for an existing customer order
exports.createRazorpayOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Order ID is required." });
  }

  const order = await Order.findOne({
    _id: orderId,
    customer: req.customer._id,
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }

  if (order.paymentMethod === "cod") {
    return res.status(400).json({
      message: "This order is a COD order.",
    });
  }

  if (order.paymentStatus === "paid") {
    return res.status(409).json({
      message: "This order is already paid.",
    });
  }

  if (order.status === "cancelled") {
    return res.status(400).json({
      message: "Cancelled orders cannot be paid.",
    });
  }

  if (!Number.isFinite(order.total) || order.total <= 0) {
    return res.status(400).json({
      message: "Invalid order amount.",
    });
  }

  // Reuse an existing Razorpay order if it was already created
  if (order.razorpayOrderId) {
    return res.json({
      key: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: order.razorpayOrderId,
      amount: Math.round(order.total * 100),
      currency: order.currency || "INR",
      order,
    });
  }

  const amount = Math.round(order.total * 100);

  const razorpayOrder = await razorpay.orders.create({
    amount,
    currency: order.currency || "INR",
    receipt: order.orderNumber,
    notes: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      customerId: String(req.customer._id),
    },
  });

  order.razorpayOrderId = razorpayOrder.id;
  await order.save();

  return res.status(201).json({
    key: process.env.RAZORPAY_KEY_ID,
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    order,
  });
});


// 2. Verify payment signature and update MongoDB
exports.verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const {
    orderId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  if (
    !orderId ||
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature
  ) {
    return res.status(400).json({
      message: "Payment verification details are incomplete.",
    });
  }

  const order = await Order.findOne({
    _id: orderId,
    customer: req.customer._id,
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }

  if (order.paymentStatus === "paid") {
    if (order.razorpayPaymentId === razorpay_payment_id) {
      return res.json({
        message: "Payment already verified.",
        order,
      });
    }

    return res.status(409).json({
      message: "This order has already been paid.",
    });
  }

  if (order.status === "cancelled") {
    return res.status(400).json({
      message: "Cancelled orders cannot be paid.",
    });
  }

  if (order.razorpayOrderId !== razorpay_order_id) {
    return res.status(400).json({
      message: "Razorpay order ID mismatch.",
    });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const signatureBuffer = Buffer.from(razorpay_signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return res.status(400).json({
      message: "Invalid payment signature.",
    });
  }

  // Fetch payment from Razorpay to confirm captured status and amount
  const payment = await razorpay.payments.fetch(razorpay_payment_id);

  if (
    payment.order_id !== razorpay_order_id ||
    payment.status !== "captured" ||
    payment.amount !== Math.round(order.total * 100) ||
    payment.currency !== (order.currency || "INR")
  ) {
    return res.status(400).json({
      message: "Payment is not captured or payment amount does not match.",
    });
  }

  // Atomic update prevents two simultaneous verification requests
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      customer: req.customer._id,
      paymentStatus: { $ne: "paid" },
      razorpayOrderId: razorpay_order_id,
    },
    {
      $set: {
        paymentStatus: "paid",
        paymentReference: razorpay_payment_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "confirmed",
        "paymentDetails.method": payment.method || "",
        "paymentDetails.bank": payment.bank || "",
        "paymentDetails.wallet": payment.wallet || "",
        "paymentDetails.vpa": payment.vpa || "",
        "paymentDetails.email": payment.email || "",
        "paymentDetails.contact": payment.contact || "",
        "paymentDetails.paidAt": new Date(),
      },
      $push: {
        statusHistory: {
          status: "confirmed",
          note: "Razorpay payment verified successfully.",
          changedAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!updatedOrder) {
    const latest = await Order.findById(order._id);

    if (
      latest?.paymentStatus === "paid" &&
      latest.razorpayPaymentId === razorpay_payment_id
    ) {
      return res.json({
        message: "Payment already verified.",
        order: latest,
      });
    }

    return res.status(409).json({
      message: "Order payment status changed. Please check your order.",
    });
  }

  // Send receipt after successful verification
  try {
    await sendPaymentReceipt(updatedOrder, req.customer);
  } catch (emailError) {
    console.error("Payment receipt email failed:", emailError);
  }

  return res.json({
    message: "Payment verified successfully.",
    order: updatedOrder,
  });
});
