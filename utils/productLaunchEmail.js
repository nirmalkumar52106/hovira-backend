const crypto = require("crypto");
const Subscriber = require("../models/Subscriber");
const { sendEmail } = require("./mailer");

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const formatMoney = (amount, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(Number(amount) || 0);

const sendNewProductLaunchEmails = async (product) => {
  const subscribers = await Subscriber.find({
    status: "active",
    consent: true,
  }).select("email");

  if (!subscribers.length) {
    return {
      total: 0,
      sent: 0,
      failed: 0,
    };
  }

  const frontendUrl = process.env.FRONTEND_URL;
  const backendUrl = process.env.BACKEND_URL;

  if (!frontendUrl || !backendUrl) {
    throw new Error("FRONTEND_URL and BACKEND_URL must be configured.");
  }

  const primaryImage =
    product.images?.find((image) => image.isPrimary) ||
    product.images?.[0];

  const productUrl =
    `${frontendUrl.replace(/\/$/, "")}/product/${encodeURIComponent(product.slug)}`;

  const imageUrl = primaryImage?.url || "";
  const price =
    product.salePrice != null ? product.salePrice : product.price;

  const safeName = escapeHtml(product.name);
  const safeDescription = escapeHtml(
    product.shortDescription || product.description
  );

  let sent = 0;
  let failed = 0;

  // Send in small batches to avoid overwhelming SMTP.
  const batchSize = 3;

  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (subscriber) => {
        const token = crypto.randomBytes(32).toString("hex");

        const tokenHash = crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");

        // Save the hashed token before sending the email.
        await Subscriber.updateOne(
          { _id: subscriber._id, status: "active" },
          { $set: { unsubscribeTokenHash: tokenHash } }
        );

        const unsubscribeUrl =
          `${backendUrl.replace(/\/$/, "")}/api/newsletter/unsubscribe/${token}`;

        const html = `
          <!DOCTYPE html>
          <html>
          <body style="margin:0;padding:24px;background:#fff7f2;font-family:Arial,sans-serif;color:#333;">
            <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:14px;overflow:hidden;">
              <div style="padding:28px;text-align:center;background:#fce9df;">
                <h1 style="margin:0;color:#a85c45;letter-spacing:4px;">HOVIRA</h1>
                <p style="margin-bottom:0;">SKINCARE & BEAUTY</p>
              </div>

              ${imageUrl ? `
                <img
                  src="${escapeHtml(imageUrl)}"
                  alt="${safeName}"
                  style="width:100%;max-height:380px;object-fit:cover;display:block;"
                />
              ` : ""}

              <div style="padding:30px;text-align:center;">
                <p style="color:#b87960;font-weight:bold;">JUST LAUNCHED</p>
                <h2 style="font-size:27px;">Meet Our New Product!</h2>
                <h3>${safeName}</h3>
                <p style="line-height:1.7;color:#666;">${safeDescription}</p>

                <h2 style="color:#a85c45;">
                  ${formatMoney(price, product.currency || "INR")}
                </h2>

                <a
                  href="${escapeHtml(productUrl)}"
                  style="display:inline-block;background:#b87960;color:#fff;text-decoration:none;padding:14px 30px;border-radius:6px;margin-top:12px;"
                >
                  SHOP NOW
                </a>
              </div>

              <div style="padding:20px;text-align:center;background:#faf4f0;font-size:12px;color:#777;">
                <p>Thank you for being a part of HOVIRA.</p>
                <p>
                  You received this email because you subscribed to HOVIRA updates.
                </p>
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#a85c45;">
                  Unsubscribe
                </a>
              </div>
            </div>
          </body>
          </html>
        `;

        return sendEmail({
          to: subscriber.email,
          subject: `New Launch: ${product.name} | HOVIRA`,
          html,
        });
      })
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        sent++;
      } else {
        failed++;
        console.error(
          "[PRODUCT LAUNCH EMAIL FAILED]",
          result.reason?.message || result.reason
        );
      }
    });
  }

  console.log("[PRODUCT LAUNCH EMAIL SUMMARY]", {
    product: product.name,
    total: subscribers.length,
    sent,
    failed,
  });

  return {
    total: subscribers.length,
    sent,
    failed,
  };
};

module.exports = { sendNewProductLaunchEmails };