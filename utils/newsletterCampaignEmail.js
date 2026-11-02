const crypto = require("crypto");

const Subscriber = require("../models/Subscriber");
const NewsletterUnsubscribeToken = require(
  "../models/NewsletterUnsubscribeToken"
);

const { sendEmail } = require("./mailer");

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const createCampaignEmail = (campaign, unsubscribeUrl) => {
  const frontendUrl = process.env.FRONTEND_URL;

  const image = campaign.imageUrl
    ? `<img src="${escapeHtml(campaign.imageUrl)}"
        alt="HOVIRA offer"
        style="width:100%;max-width:520px;border-radius:12px;margin:20px 0;" />`
    : "";

  const offer = campaign.offerDetails
    ? `<div style="background:#fff2e8;padding:18px;border-radius:12px;margin:20px 0;">
         <h2 style="color:#e87518;margin:0 0 8px;">
           ${escapeHtml(campaign.offerDetails)}
         </h2>
       </div>`
    : "";

  return `
    <div style="background:#fff8f2;padding:30px 12px;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;">

        <div style="background:#f58232;padding:25px;text-align:center;color:white;">
          <h1 style="margin:0;letter-spacing:4px;">HOVIRA</h1>
          <p style="margin:6px 0 0;">SKINCARE & BEAUTY</p>
        </div>

        <div style="padding:30px 25px;text-align:center;">

          ${
            campaign.previewText
              ? `<p style="color:#777;">${escapeHtml(campaign.previewText)}</p>`
              : ""
          }

          <h2 style="color:#292929;">
            ${escapeHtml(campaign.heading)}
          </h2>

          ${image}

          <p style="color:#666;line-height:1.8;">
            ${escapeHtml(campaign.message).replace(/\n/g, "<br>")}
          </p>

          ${offer}

          <a href="${escapeHtml(campaign.ctaUrl || frontendUrl)}"
             style="display:inline-block;background:#f58232;color:#fff;
             padding:15px 35px;border-radius:8px;text-decoration:none;
             font-weight:bold;margin:15px 0;">
            ${escapeHtml(campaign.ctaText || "Shop Now")}
          </a>

          <p style="color:#888;font-size:13px;margin-top:30px;">
            Thank you for being a part of HOVIRA.
          </p>
        </div>

        <div style="background:#fff2e8;padding:20px;text-align:center;">
          <p style="color:#777;font-size:12px;">
            You received this email because you subscribed to HOVIRA updates.
          </p>

          <a href="${escapeHtml(unsubscribeUrl)}"
             style="color:#d66c20;font-size:12px;">
            Unsubscribe
          </a>
        </div>

      </div>
    </div>
  `;
};

exports.sendNewsletterCampaign = async (campaign) => {
  const subscribers = await Subscriber.find({
    status: "active",
    consent: true,
  }).select("_id email");

  const stats = {
    total: subscribers.length,
    sent: 0,
    failed: 0,
  };

  const frontendUrl = process.env.FRONTEND_URL;
  const backendUrl = process.env.BACKEND_URL;

  if (!frontendUrl || !backendUrl) {
    throw new Error("FRONTEND_URL and BACKEND_URL must be configured.");
  }

  for (const subscriber of subscribers) {
    try {
      const token = crypto.randomBytes(32).toString("hex");

      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      await NewsletterUnsubscribeToken.create({
        subscriber: subscriber._id,
        tokenHash,
      });

      const unsubscribeUrl =
        `${backendUrl.replace(/\/$/, "")}/api/newsletter/unsubscribe/${token}`;

      const html = createCampaignEmail(
        campaign,
        unsubscribeUrl
      );

      await sendEmail({
        to: subscriber.email,
        subject: campaign.subject,
        html,
      });

      stats.sent++;
    } catch (error) {
      stats.failed++;

      console.error(
        `[NEWSLETTER] Failed for ${subscriber.email}:`,
        error.message
      );
    }
  }

  return stats;
};