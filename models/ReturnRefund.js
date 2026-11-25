
const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    sku: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const proofImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const returnRefundSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      unique: true,
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    requestType: {
      type: String,
      enum: ["return", "cancellation"],
      required: true,
    },

    items: {
      type: [returnItemSchema],
      default: [],
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    proofImages: {
      type: [proofImageSchema],
      default: [],
    },

    status: {
      type: String,
      enum: [
        "requested",
        "under_review",
        "approved",
        "rejected",
        "pickup_scheduled",
        "picked_up",
        "received",
        "inspection_passed",
        "inspection_failed",
        "refund_approved",
        "refund_processing",
        "refunded",
        "cancelled",
      ],
      default: "requested",
      index: true,
    },

    // Admin review
    adminNote: {
      type: String,
      default: "",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    // Local pickup management
    pickup: {
      employeeName: {
        type: String,
        default: "",
      },
      employeePhone: {
        type: String,
        default: "",
      },
      scheduledDate: {
        type: Date,
        default: null,
      },
      scheduledTime: {
        type: String,
        default: "",
      },
      status: {
        type: String,
        enum: [
          "not_scheduled",
          "scheduled",
          "assigned",
          "completed",
          "failed",
        ],
        default: "not_scheduled",
      },
      note: {
        type: String,
        default: "",
      },
      completedAt: {
        type: Date,
        default: null,
      },
    },

    // Product inspection
    inspection: {
      status: {
        type: String,
        enum: ["pending", "passed", "failed"],
        default: "pending",
      },
      note: {
        type: String,
        default: "",
      },
      inspectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
      },
      inspectedAt: {
        type: Date,
        default: null,
      },
    },

    // Refund calculation
    refund: {
      eligibleAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      refundPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },

      refundAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      deductionAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      packingCharge: {
        type: Number,
        default: 0,
        min: 0,
      },

      deliveryCharge: {
        type: Number,
        default: 0,
        min: 0,
      },

      pickupCharge: {
        type: Number,
        default: 0,
        min: 0,
      },

      otherDeduction: {
        type: Number,
        default: 0,
        min: 0,
      },

      calculationNote: {
        type: String,
        default: "",
      },

      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
      },

      approvedAt: {
        type: Date,
        default: null,
      },

      processedAt: {
        type: Date,
        default: null,
      },

      paymentReference: {
        type: String,
        default: "",
      },

      razorpayRefundId: {
        type: String,
        default: "",
        index: true,
      },

      refundMethod: {
        type: String,
        enum: ["razorpay", "bank", "upi", ""],
        default: "",
      },

      status: {
        type: String,
        enum: [
          "not_applicable",
          "pending",
          "processing",
          "completed",
          "failed",
        ],
        default: "pending",
      },
    },

    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        note: {
          type: String,
          default: "",
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Admin",
          default: null,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    rejectedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

returnRefundSchema.index({ customer: 1, createdAt: -1 });
returnRefundSchema.index({ status: 1, createdAt: -1 });
returnRefundSchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.model("ReturnRefund", returnRefundSchema);
