
const { sendEmail } = require("./mailer");

const formatMoney = (amount, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(Number(amount) || 0);

const itemsHtml = (order) =>
  (order.items || [])
    .map(
      (item) => `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${formatMoney(item.unitPrice, order.currency)}</td>
          <td>${formatMoney(item.lineTotal, order.currency)}</td>
        </tr>
      `
    )
    .join("");

const orderDetailsHtml = (order) => `
  <h2>Order ${order.orderNumber}</h2>
  <p><b>Order status:</b> ${order.status}</p>
  <p><b>Payment status:</b> ${order.paymentStatus}</p>
  <p><b>Payment method:</b> ${order.paymentMethod}</p>

  <table border="1" cellpadding="8" cellspacing="0">
    <thead>
      <tr>
        <th>Product</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${itemsHtml(order)}</tbody>
  </table>

  <p>Subtotal: ${formatMoney(order.subtotal, order.currency)}</p>
  <p>Discount: ${formatMoney(order.discount, order.currency)}</p>
  <p>Shipping: ${formatMoney(order.shippingFee, order.currency)}</p>
  <h3>Grand Total: ${formatMoney(order.total, order.currency)}</h3>

  <h3>Delivery Address</h3>
  <p>
    ${order.shippingAddress?.fullName || ""}<br>
    ${order.shippingAddress?.phone || ""}<br>
    ${order.shippingAddress?.addressLine1 || ""}<br>
    ${order.shippingAddress?.addressLine2 || ""}<br>
    ${order.shippingAddress?.city || ""},
    ${order.shippingAddress?.state || ""}
    ${order.shippingAddress?.postalCode || ""}<br>
    ${order.shippingAddress?.country || ""}
  </p>
`;

async function sendNewOrderAdminEmail(order, customer) {
  return sendEmail({
    to: process.env.ADMIN_ORDER_EMAIL,
    subject: `New HOVIRA Order: ${order.orderNumber}`,
    html: `
      <h1>New Order Received</h1>
      <p>Customer: ${customer?.name || order.shippingAddress?.fullName || "Customer"}</p>
      <p>Email: ${customer?.email || "Not available"}</p>
      ${orderDetailsHtml(order)}
    `,
  });
}

async function sendOrderConfirmationEmail(order, customer) {
  return sendEmail({
    to: customer?.email,
    subject: `HOVIRA Order Confirmation: ${order.orderNumber}`,
    html: `
      <h1>Thank you for your order!</h1>
      <p>Hello ${customer?.name || order.shippingAddress?.fullName || "Customer"},</p>
      <p>We received your order and will keep you updated on its status.</p>
      ${orderDetailsHtml(order)}
    `,
  });
}

async function sendStatusEmail(order, customer) {
  if (!customer?.email) return;

  const tracking = order.trackingNumber
    ? `<p><b>Tracking Number:</b> ${order.trackingNumber}</p>`
    : "";

  const carrier = order.carrier
    ? `<p><b>Courier:</b> ${order.carrier}</p>`
    : "";

  return sendEmail({
    to: customer.email,
    subject: `HOVIRA Order ${order.orderNumber}: ${order.status}`,
    html: `
      <h1>Your order status is now: ${order.status}</h1>
      <p>Hello ${customer.name || order.shippingAddress?.fullName || "Customer"},</p>
      ${tracking}
      ${carrier}
      ${orderDetailsHtml(order)}
    `,
  });
}

async function sendPaymentReceipt(order, customer) {
  if (!customer?.email) return;

  return sendEmail({
    to: customer.email,
    subject: `Payment Receipt - HOVIRA ${order.orderNumber}`,
    html: `
      <h1>Payment Received Successfully</h1>
      <p>Hello ${customer.name || order.shippingAddress?.fullName || "Customer"},</p>
      <p>Your payment has been verified and recorded.</p>
      <p><b>Payment Reference:</b> ${order.paymentReference || "Not provided"}</p>
      <p><b>Payment Date:</b> ${new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      })}</p>
      ${orderDetailsHtml(order)}
    `,
  });
}

module.exports = {
  sendNewOrderAdminEmail,
  sendOrderConfirmationEmail,
  sendStatusEmail,
  sendPaymentReceipt,
};
