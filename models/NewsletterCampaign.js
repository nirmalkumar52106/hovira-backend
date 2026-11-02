const mongoose = require("mongoose");

const newsletterCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    previewText: { type: String, default: "" },
    heading: { type: String, required: true },
    message: { type: String, required: true },

    offerType: {
      type: String,
      enum: [
        "none",
        "percentage",
        "flat",
        "buy_x_get_y",
        "free_shipping",
        "custom",
      ],
      default: "none",
    },

    offerValue: { type: Number, default: 0 },
    minQuantity: { type: Number, default: 1 },
    offerDetails: { type: String, default: "" },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    productName: { type: String, default: "" },
    productUrl: { type: String, default: "" },
    imageUrl: { type: String, default: "" },

    ctaText: { type: String, default: "Shop Now" },
    ctaUrl: { type: String, default: "" },

    status: {
      type: String,
      enum: ["sending", "sent", "partial", "failed"],
      default: "sending",
    },

    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },

    sentAt: { type: Date, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "NewsletterCampaign",
  newsletterCampaignSchema
);