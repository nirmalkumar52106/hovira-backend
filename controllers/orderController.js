const mongoose = require('mongoose');
const {
  sendNewOrderAdminEmail,
  sendOrderConfirmationEmail,
  sendStatusEmail,
  sendPaymentReceipt,
} = require("../utils/orderEmails");
const Product = require('../models/Product'); 
const Coupon = require('../models/Coupon');
 const Order = require('../models/Order');
const asyncHandler = require('../middleware/asyncHandler');
 const { getPagination, paginated } = require('../utils/pagination');
function addressSnapshot(a) { if (!a) return null; 
  const keys = ['fullName','phone','addressLine1','addressLine2','landmark','city','state','postalCode','country']; const out = {}; keys.forEach(k => { if (a[k] !== undefined) out[k] = a[k]; }); return out; }

exports.createOrder = asyncHandler(async (req, res) => {
  const {
    items,
    addressId,
    shippingAddress,
    paymentMethod = "cod",
    customerNote = "",
    couponCode,
  } = req.body;

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({
      message: "At least one order item is required.",
    });
  }

  let address = shippingAddress;

  if (addressId) {
    address = req.customer.addresses.id(addressId);
  }

  const requiredAddress = [
    "fullName",
    "phone",
    "addressLine1",
    "city",
    "state",
    "postalCode",
  ];

  if (!address || requiredAddress.some((key) => !address[key])) {
    return res.status(400).json({
      message: "A complete shipping address is required.",
    });
  }

  if (!["cod", "online", "upi", "card", "netbanking"].includes(paymentMethod)) {
    return res.status(400).json({
      message: "Invalid payment method.",
    });
  }

  const session = await mongoose.startSession();
  let created;

  try {
    await session.withTransaction(async () => {
      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        const qty = Number(item.quantity);

        if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
          throw Object.assign(
            new Error("Each quantity must be an integer between 1 and 100."),
            { statusCode: 400 }
          );
        }

        const product = await Product.findOne({
          _id: item.productId,
          isActive: true,
        }).session(session);

        if (!product) {
          throw Object.assign(
            new Error(`Product not found: ${item.productId}`),
            { statusCode: 404 }
          );
        }

        if (product.stock < qty) {
          throw Object.assign(
            new Error(
              `Insufficient stock for ${product.name}. Available: ${product.stock}`
            ),
            { statusCode: 409 }
          );
        }

        const unitPrice =
          product.salePrice != null ? product.salePrice : product.price;

        const lineTotal = Math.round(unitPrice * qty * 100) / 100;
        subtotal += lineTotal;

        const primary =
          product.images.find((image) => image.isPrimary) ||
          product.images[0];

        orderItems.push({
          product: product._id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          image: primary?.url || "",
          unitPrice,
          quantity: qty,
          lineTotal,
          variant: item.variant || "",
        });

        product.stock -= qty;
        await product.save({ session });
      }

      let discount = 0;
      let coupon = null;
      let normalizedCode = "";

      if (couponCode) {
        normalizedCode = String(couponCode).trim().toUpperCase();

        coupon = await Coupon.findOne({
          code: normalizedCode,
          isActive: true,
        }).session(session);

        if (!coupon) {
          throw Object.assign(new Error("Coupon is invalid or inactive."), {
            statusCode: 400,
          });
        }

        const now = new Date();

        if (
          (coupon.startsAt && now < coupon.startsAt) ||
          (coupon.expiresAt && now > coupon.expiresAt)
        ) {
          throw Object.assign(new Error("Coupon is outside its active dates."), {
            statusCode: 400,
          });
        }

        if (
          coupon.usageLimit != null &&
          coupon.usedCount >= coupon.usageLimit
        ) {
          throw Object.assign(new Error("Coupon usage limit reached."), {
            statusCode: 400,
          });
        }

        if (subtotal < coupon.minOrderAmount) {
          throw Object.assign(
            new Error(`Minimum order amount is ${coupon.minOrderAmount}.`),
            { statusCode: 400 }
          );
        }

        const usage = coupon.usedBy.find(
          (entry) => String(entry.customer) === String(req.customer._id)
        );

        if (usage && usage.count >= coupon.perCustomerLimit) {
          throw Object.assign(
            new Error("You have reached this coupon usage limit."),
            { statusCode: 400 }
          );
        }

        if (
          coupon.applicableProductIds.length &&
          !orderItems.some((item) =>
            coupon.applicableProductIds.some(
              (id) => String(id) === String(item.product)
            )
          )
        ) {
          throw Object.assign(
            new Error("Coupon does not apply to these products."),
            { statusCode: 400 }
          );
        }

        discount =
          coupon.discountType === "percentage"
            ? (subtotal * coupon.discountValue) / 100
            : coupon.discountValue;

        if (coupon.maxDiscount != null) {
          discount = Math.min(discount, coupon.maxDiscount);
        }

        discount = Math.min(
          Math.round(discount * 100) / 100,
          subtotal
        );

        coupon.usedCount += 1;

        if (usage) {
          usage.count += 1;
        } else {
          coupon.usedBy.push({
            customer: req.customer._id,
            count: 1,
          });
        }

        await coupon.save({ session });
      }

      const shippingFee = Number(process.env.DEFAULT_SHIPPING_FEE || 0);
      const tax = 0;

      const total = Math.max(
        0,
        Math.round((subtotal - discount + shippingFee + tax) * 100) / 100
      );

      const orderNumber =
        `HOV-${Date.now().toString(36).toUpperCase()}-` +
        Math.random().toString(36).slice(2, 6).toUpperCase();

      const docs = await Order.create(
        [
          {
            orderNumber,
            customer: req.customer._id,
            items: orderItems,
            shippingAddress: addressSnapshot(address),
            subtotal: Math.round(subtotal * 100) / 100,
            discount,
            shippingFee,
            tax,
            total,
            coupon: coupon?._id || null,
            couponCode: normalizedCode,
            currency: process.env.CURRENCY || "INR",
            paymentMethod,
            paymentStatus: "pending",
            status: "pending",
            customerNote,
            statusHistory: [
              {
                status: "pending",
                note: "Order created by customer",
              },
            ],
          },
        ],
        { session }
      );

      created = docs[0];
    });
  } finally {
    await session.endSession();
  }

  // Send email only after the order transaction has completed.
  const emailResults = await Promise.allSettled([
    sendOrderConfirmationEmail(created, req.customer),
    sendNewOrderAdminEmail(created, req.customer),
  ]);

  emailResults.forEach((result, index) => {
    const recipient = index === 0 ? "Customer confirmation" : "Admin order";

    if (result.status === "fulfilled") {
      console.log(`${recipient} email sent:`, result.value);
      return;
    }

    const emailError = result.reason;
    console.error(`${recipient} email failed:`, {
      message: emailError.message,
      code: emailError.code,
      command: emailError.command,
      response: emailError.response,
      stack: emailError.stack,
    });
  });

  return res.status(201).json({
    message: "Order created successfully.",
    order: created,
  });
});

exports.myOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query); const filter = { customer: req.customer._id };
  const [orders, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Order.countDocuments(filter)]); res.json(paginated(orders, total, page, limit));
});

exports.getMyOrder = asyncHandler(async (req, res) => { const order = await Order.findOne({ _id: req.params.id, customer: req.customer._id }); if (!order) return res.status(404).json({ message: 'Order not found.' }); res.json({ order }); });
exports.cancelMyOrder = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession(); let order;
  try { await session.withTransaction(async () => {
    order = await Order.findOne({ _id: req.params.id, customer: req.customer._id }).session(session);
    if (!order) throw Object.assign(new Error('Order not found.'), { statusCode: 404 });
    if (!['pending','confirmed'].includes(order.status)) throw Object.assign(new Error('This order can no longer be cancelled online.'), { statusCode: 400 });
    if (order.paymentStatus === 'paid') throw Object.assign(new Error('Paid orders require admin refund review before cancellation.'), { statusCode: 400 });
    for (const item of order.items) await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }, { session });
    order.status = 'cancelled'; order.cancelledAt = new Date(); order.statusHistory.push({ status: 'cancelled', note: req.body.reason || 'Cancelled by customer' }); await order.save({ session });
  }); } finally { await session.endSession(); }
  res.json({ message: 'Order cancelled.', order });
});
exports.adminListOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query); const filter = {};
  if (req.query.status) filter.status = req.query.status; if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.q) { const q = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const customers = await require('../models/Customer').find({ $or: [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }] }).select('_id'); filter.$or = [{ orderNumber: new RegExp(q, 'i') }, { customer: { $in: customers.map(c => c._id) } }]; }
  const [orders, total] = await Promise.all([Order.find(filter).populate('customer', 'name email phone').sort({ createdAt: -1 }).skip(skip).limit(limit), Order.countDocuments(filter)]); res.json(paginated(orders, total, page, limit));
});
exports.adminGetOrder = asyncHandler(async (req, res) => { const order = await Order.findById(req.params.id).populate('customer', 'name email phone'); if (!order) return res.status(404).json({ message: 'Order not found.' }); res.json({ order }); });


exports.adminUpdateOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "customer",
    "name email phone"
  );

  if (!order) {
    return res.status(404).json({
      message: "Order not found.",
    });
  }

  // Store previous values before updating
  const previousStatus = order.status;
  const previousPaymentStatus = order.paymentStatus;

  const {
    status,
    paymentStatus,
    paymentReference,
    trackingNumber,
    carrier,
    adminNote,
  } = req.body;

  // Valid order statuses
  const validStatus = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "returned",
  ];

  // Valid payment statuses
  const validPayment = [
    "pending",
    "paid",
    "failed",
    "refunded",
    "partially_refunded",
  ];

  // Validate order status
  if (status && !validStatus.includes(status)) {
    return res.status(400).json({
      message: "Invalid order status.",
    });
  }

  // Validate payment status
  if (paymentStatus && !validPayment.includes(paymentStatus)) {
    return res.status(400).json({
      message: "Invalid payment status.",
    });
  }

  // =====================================
  // ORDER STATUS UPDATE
  // =====================================

  if (status && status !== order.status) {
    // Prevent updating delivered/cancelled orders
    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        message:
          "Delivered/cancelled orders cannot be changed through this endpoint.",
      });
    }

    // Prevent cancelling paid orders without refund
    if (
      status === "cancelled" &&
      order.paymentStatus === "paid"
    ) {
      return res.status(400).json({
        message:
          "Paid order must be refunded through payment provider before cancellation.",
      });
    }

    // Restore stock when order is cancelled
    if (status === "cancelled") {
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product },
          {
            $inc: {
              stock: item.quantity,
            },
          }
        );
      }

      order.cancelledAt = new Date();
    }

    // Delivered date
    if (status === "delivered") {
      order.deliveredAt = new Date();
    }

    // Update status
    order.status = status;

    // Add status history
    order.statusHistory.push({
      status,
      note:
        adminNote ||
        `Status changed by ${req.admin?.name || "Admin"}`,
      changedBy: req.admin?._id,
    });
  }

  // =====================================
  // PAYMENT STATUS UPDATE
  // =====================================

  if (paymentStatus) {
    if (
      paymentStatus === "paid" &&
      order.paymentMethod !== "cod" &&
      !paymentReference &&
      !order.paymentReference
    ) {
      return res.status(400).json({
        message:
          "A verified payment reference is required.",
      });
    }

    order.paymentStatus = paymentStatus;
  }

  // Payment reference
  if (paymentReference !== undefined) {
    order.paymentReference = paymentReference;
  }

  // Tracking number
  if (trackingNumber !== undefined) {
    order.trackingNumber = trackingNumber;
  }

  // Carrier
  if (carrier !== undefined) {
    order.carrier = carrier;
  }

  // Admin note
  if (adminNote !== undefined) {
    order.adminNote = adminNote;
  }

  // =====================================
  // SAVE ORDER
  // =====================================

  await order.save();

  const customer = order.customer;

  console.log("====================================");
  console.log("ADMIN ORDER UPDATE");
  console.log("Order ID:", order._id);
  console.log("Customer:", customer?.name);
  console.log("Customer Email:", customer?.email);
  console.log("Previous Status:", previousStatus);
  console.log("Updated Status:", order.status);
  console.log("Previous Payment:", previousPaymentStatus);
  console.log("Updated Payment:", order.paymentStatus);
  console.log("====================================");

  // =====================================
  // ORDER STATUS EMAIL
  // =====================================

  if (order.status !== previousStatus) {
    console.log("Order status changed. Sending email...");

    try {
      if (!customer) {
        throw new Error("Order customer not found.");
      }

      if (!customer.email) {
        throw new Error("Customer email not found.");
      }

      await sendStatusEmail(order, customer);

      console.log(
        "SUCCESS: Order status email sent to:",
        customer.email
      );
    } catch (err) {
      console.error("ORDER STATUS EMAIL FAILED");
      console.error("Order ID:", order._id);
      console.error("Customer Email:", customer?.email);
      console.error("Error:", err.message);
      console.error(err.stack);
    }
  } else {
    console.log(
      "Order status unchanged. Status email skipped."
    );
  }

  // =====================================
  // PAYMENT RECEIPT EMAIL
  // =====================================

  if (
    previousPaymentStatus !== "paid" &&
    order.paymentStatus === "paid"
  ) {
    console.log("Payment changed to PAID. Sending receipt...");

    try {
      if (!customer) {
        throw new Error("Order customer not found.");
      }

      if (!customer.email) {
        throw new Error("Customer email not found.");
      }

      await sendPaymentReceipt(order, customer);

      console.log(
        "SUCCESS: Payment receipt sent to:",
        customer.email
      );
    } catch (err) {
      console.error("PAYMENT RECEIPT EMAIL FAILED");
      console.error("Order ID:", order._id);
      console.error("Customer Email:", customer?.email);
      console.error("Error:", err.message);
      console.error(err.stack);
    }
  } else {
    console.log(
      "Payment receipt condition not matched."
    );
  }

  // =====================================
  // RESPONSE
  // =====================================

  return res.status(200).json({
    message: "Order updated successfully.",
    order,
  });
});

