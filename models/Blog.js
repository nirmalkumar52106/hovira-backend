const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    excerpt: {
      type: String,
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    featuredImage: {
      url: {
        type: String,
        default: "",
      },
      publicId: {
        type: String,
        default: "",
      },
      alt: {
        type: String,
        default: "",
      },
    },

    category: {
      type: String,
      default: "General",
    },

    tags: {
      type: [String],
      default: [],
    },

    author: {
      type: String,
      default: "HOVIRA",
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    readTime: {
      type: Number,
      default: 1,
    },

    // SEO fields
    metaTitle: {
      type: String,
      default: "",
    },

    metaDescription: {
      type: String,
      default: "",
    },

    keywords: {
      type: [String],
      default: [],
    },

    canonicalUrl: {
      type: String,
      default: "",
    },

    ogTitle: {
      type: String,
      default: "",
    },

    ogDescription: {
      type: String,
      default: "",
    },

    ogImage: {
      type: String,
      default: "",
    },

    noIndex: {
      type: Boolean,
      default: false,
    },

    // FAQ schema data
    faqs: [
      {
        question: {
          type: String,
          trim: true,
        },
        answer: {
          type: String,
          trim: true,
        },
      },
    ],

    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1 });
blogSchema.index({ tags: 1 });

module.exports = mongoose.model("Blog", blogSchema);