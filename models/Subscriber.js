const mongoose = require("mongoose");

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "unsubscribed"],
      default: "active",
      index: true,
    },

    source: {
      type: String,
      default: "website_newsletter",
    },

    subscribedAt: {
      type: Date,
      default: Date.now,
    },

    unsubscribedAt: {
      type: Date,
      default: null,
    },

    // Unsubscribe link ke liye hashed token
    unsubscribeTokenHash: {
      type: String,
      default: "",
    },

    consent: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscriber", subscriberSchema);