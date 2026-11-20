const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { confirmPaidOrderAndNotify } = require("./orderController");

function verifyWebhookSignature(rawBodyBuffer, signatureHeader, secret) {
  if (!secret) {
    
    return process.env.ALLOW_UNVERIFIED_WEBHOOK === "true";
  }

  if (!signatureHeader || !rawBodyBuffer) {
    return false;
  }

  const expectedDigest = crypto
    .createHmac("sha256", secret)
    .update(rawBodyBuffer)
    .digest("hex");

  const incomingSig = String(signatureHeader).trim();
  const expectedBuf = Buffer.from(expectedDigest, "utf8");
  const incomingBuf = Buffer.from(incomingSig, "utf8");

  if (expectedBuf.length !== incomingBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, incomingBuf);
}

function parseWebhookPayload(req) {
  let payload = req.body;

  if (Buffer.isBuffer(payload)) {
    payload = JSON.parse(payload.toString("utf8"));
  } else if (typeof payload === "string") {
    payload = JSON.parse(payload);
  }

  const event = payload?.event || payload?.type || "";

  // Razorpay-style nested entities (payment.captured / order.paid / payment.failed)
  const paymentEntity = payload?.payload?.payment?.entity || {};
  const orderEntity = payload?.payload?.order?.entity || {};
  const notes = paymentEntity?.notes || orderEntity?.notes || {};

  // Supports both gateway notes (orderId / orderNumber) and direct payload fields
  const orderId =
    notes.orderId ||
    payload?.orderId ||
    paymentEntity?.notes?.order_id ||
    null;

  const orderNumber =
    notes.orderNumber ||
    payload?.orderNumber ||
    orderEntity?.receipt ||
    null;

  const paymentReference =
    paymentEntity?.id ||
    payload?.paymentId ||
    payload?.paymentReference ||
    "";

  return {
    event,
    orderId,
    orderNumber,
    paymentReference,
    raw: payload,
  };
}

async function findTargetOrder({ orderId, orderNumber }) {
  if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
    const byId = await Order.findById(orderId);
    if (byId) return byId;
  }

  if (orderNumber) {
    const byNumber = await Order.findOne({ orderNumber: String(orderNumber).trim() });
    if (byNumber) return byNumber;
  }

  return null;
}

async function handlePaymentFailed(order, paymentReference) {
  if (!order) return;

  // Do not overwrite already paid or cancelled orders
  if (order.paymentStatus === "paid" || order.status === "cancelled") {
    return;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const freshOrder = await Order.findById(order._id).session(session);
      if (!freshOrder) return;

      if (freshOrder.paymentStatus === "paid" || freshOrder.status === "cancelled") {
        return;
      }

      // Restore reserved stock if order is still pending
      if (freshOrder.status === "pending") {
        for (const item of freshOrder.items) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } },
            { session }
          );
        }
        freshOrder.status = "cancelled";
        freshOrder.cancelledAt = new Date();
      }

      freshOrder.paymentStatus = "failed";
      if (paymentReference) {
        freshOrder.paymentReference = paymentReference;
      }

      freshOrder.statusHistory.push({
        status: freshOrder.status,
        note: paymentReference
          ? `Payment failed (Ref: ${paymentReference})`
          : "Payment failed",
      });

      await freshOrder.save({ session });
    });
  } finally {
    await session.endSession();
  }
}

exports.handlePaymentWebhook = async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}), "utf8");

    const signature =
      req.headers["x-razorpay-signature"] ||
      req.headers["x-webhook-signature"] ||
      "";

    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "";

    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.warn("Invalid payment webhook signature.");
      return res.status(401).json({ message: "Invalid webhook signature." });
    }

    const { event, orderId, orderNumber, paymentReference } =
      parseWebhookPayload(req);

    console.log("Received payment webhook:", {
      event,
      orderId,
      orderNumber,
      paymentReference,
    });

    const order = await findTargetOrder({ orderId, orderNumber });
    if (!order) {
      // Return 200 or 404 based on gateway retry policy; 200 avoids endless retries for unknown orders
      console.warn("Webhook order not found:", { orderId, orderNumber });
      return res.status(200).json({
        received: true,
        message: "Order not found for webhook payload.",
      });
    }

    const normalizedEvent = String(event).toLowerCase();

    const isSuccessEvent = [
      "payment.captured",
      "order.paid",
      "payment.succeeded",
      "payment_success",
    ].includes(normalizedEvent);

    const isFailureEvent = [
      "payment.failed",
      "payment_failed",
    ].includes(normalizedEvent);

    if (isSuccessEvent) {
      // Idempotent: confirmPaidOrderAndNotify checks wasAlreadyPaid before sending duplicate emails
      await confirmPaidOrderAndNotify(order._id, paymentReference);
      return res.status(200).json({
        received: true,
        message: "Order marked paid and notifications dispatched.",
      });
    }

    if (isFailureEvent) {
      await handlePaymentFailed(order, paymentReference);
      return res.status(200).json({
        received: true,
        message: "Payment failure processed.",
      });
    }

    return res.status(200).json({
      received: true,
      message: `Unhandled event type: ${event}`,
    });
  } catch (err) {
    console.error("Payment webhook error:", err);
    return res.status(500).json({
      message: "Webhook processing failed.",
    });
  }
};