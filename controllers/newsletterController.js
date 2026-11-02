const crypto = require("crypto");
const Subscriber = require("../models/Subscriber");

// Generate secure unsubscribe token
const generateUnsubscribeToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Store token as hash, not plain text
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// Escape regex input for search
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/*
|--------------------------------------------------------------------------
| PUBLIC: Subscribe newsletter
| POST /api/newsletter/subscribe
|--------------------------------------------------------------------------
*/
exports.subscribeNewsletter = async (req, res) => {
  try {
    let { email } = req.body;

    email = String(email || "").trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const token = generateUnsubscribeToken();
    const tokenHash = hashToken(token);

    let subscriber = await Subscriber.findOne({ email });

    if (subscriber) {
      if (subscriber.status === "active") {
        return res.status(200).json({
          success: true,
          message: "You are already subscribed to HOVIRA updates.",
        });
      }

      // Re-subscribe previously unsubscribed email
      subscriber.status = "active";
      subscriber.subscribedAt = new Date();
      subscriber.unsubscribedAt = null;
      subscriber.unsubscribeTokenHash = tokenHash;
      subscriber.consent = true;
      await subscriber.save();
    } else {
      subscriber = await Subscriber.create({
        email,
        status: "active",
        source: "website_newsletter",
        subscribedAt: new Date(),
        consent: true,
        unsubscribeTokenHash: tokenHash,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Thank you for subscribing to HOVIRA updates!",
    });
  } catch (error) {
    // Handle simultaneous duplicate subscription requests
    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        message: "You are already subscribed to HOVIRA updates.",
      });
    }

    console.error("Newsletter subscribe error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to subscribe right now. Please try again.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| PUBLIC: Unsubscribe
| GET /api/newsletter/unsubscribe/:token
|--------------------------------------------------------------------------
*/
exports.unsubscribeNewsletter = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).send("Invalid unsubscribe link.");
    }

    const tokenHash = hashToken(token);

    const subscriber = await Subscriber.findOne({
      unsubscribeTokenHash: tokenHash,
    });

    if (!subscriber) {
      return res.status(404).send("This unsubscribe link is invalid or expired.");
    }

    if (subscriber.status === "unsubscribed") {
      return res.status(200).send("You are already unsubscribed from HOVIRA emails.");
    }

    subscriber.status = "unsubscribed";
    subscriber.unsubscribedAt = new Date();

    // Invalidate the old link
    subscriber.unsubscribeTokenHash = "";

    await subscriber.save();

    return res.status(200).send(
      "You have successfully unsubscribed from HOVIRA marketing emails."
    );
  } catch (error) {
    console.error("Newsletter unsubscribe error:", error);

    return res.status(500).send("Unable to unsubscribe right now.");
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN: Get subscribers
| GET /api/admin/newsletter/subscribers?page=1&limit=20&q=&status=active
|--------------------------------------------------------------------------
*/
exports.getNewsletterSubscribers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();

    const filter = {};

    if (q) {
      filter.email = {
        $regex: escapeRegex(q),
        $options: "i",
      };
    }

    if (["active", "unsubscribed"].includes(status)) {
      filter.status = status;
    }

    const [subscribers, total, activeCount, unsubscribedCount] =
      await Promise.all([
        Subscriber.find(filter)
          .select("-unsubscribeTokenHash")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        Subscriber.countDocuments(filter),

        Subscriber.countDocuments({ status: "active" }),

        Subscriber.countDocuments({ status: "unsubscribed" }),
      ]);

    return res.status(200).json({
      success: true,
      subscribers,
      stats: {
        total: activeCount + unsubscribedCount,
        active: activeCount,
        unsubscribed: unsubscribedCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get newsletter subscribers error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch newsletter subscribers.",
    });
  }
};