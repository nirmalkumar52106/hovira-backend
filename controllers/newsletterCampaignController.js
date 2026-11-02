const NewsletterCampaign = require("../models/NewsletterCampaign");
const Product = require("../models/Product");

const {
  sendNewsletterCampaign,
} = require("../utils/newsletterCampaignEmail");

// ==========================================
// CREATE AND SEND CAMPAIGN
// ==========================================

exports.createCampaign = async (req, res) => {
  let campaign;

  try {
    const {
      name,
      subject,
      previewText,
      heading,
      message,
      offerType,
      offerValue,
      minQuantity,
      offerDetails,
      productId,
      ctaText,
      ctaUrl,
      imageUrl,
    } = req.body;

    if (!name || !subject || !heading || !message) {
      return res.status(400).json({
        success: false,
        message: "Campaign name, subject, heading and message are required.",
      });
    }

    let product = null;

    if (productId) {
      product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Selected product not found.",
        });
      }
    }

    const frontendUrl = process.env.FRONTEND_URL;

    const productUrl = product
      ? `${frontendUrl.replace(/\/$/, "")}/product/${product.slug}`
      : "";

    const campaignCtaUrl =
      ctaUrl || productUrl || `${frontendUrl}/products`;

    campaign = await NewsletterCampaign.create({
      name,
      subject,
      previewText,
      heading,
      message,
      offerType: offerType || "none",
      offerValue: Number(offerValue) || 0,
      minQuantity: Number(minQuantity) || 1,
      offerDetails,
      product: product?._id || null,
      productName: product?.name || "",
      productUrl,
      imageUrl: imageUrl || product?.images?.find(
        (img) => img.isPrimary
      )?.url || product?.images?.[0]?.url || "",
      ctaText: ctaText || "Shop Now",
      ctaUrl: campaignCtaUrl,
      status: "sending",
      createdBy: req.admin?._id,
    });

    const stats = await sendNewsletterCampaign(campaign);

    let status = "sent";

    if (stats.failed > 0 && stats.sent > 0) {
      status = "partial";
    } else if (stats.failed > 0 && stats.sent === 0) {
      status = "failed";
    }

    campaign.status = status;
    campaign.stats = stats;
    campaign.sentAt = stats.sent > 0 ? new Date() : null;

    await campaign.save();

    return res.status(201).json({
      success: true,
      message: "Newsletter campaign processing completed.",
      campaign,
    });
  } catch (error) {
    console.error("[CAMPAIGN ERROR]", error);

    if (campaign) {
      campaign.status = "failed";
      await campaign.save().catch(console.error);
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Campaign sending failed.",
    });
  }
};

// ==========================================
// GET CAMPAIGN HISTORY
// ==========================================

exports.getCampaigns = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      NewsletterCampaign.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      NewsletterCampaign.countDocuments(),
    ]);

    res.json({
      success: true,
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to fetch campaigns.",
    });
  }
};