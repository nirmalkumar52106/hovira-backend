const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { sendEmail } = require("../utils/mailer");

const recipient = "nirmalkumar52106@gmail.com";
const emailTestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: "Email test limit reached. Try again in 15 minutes." },
  },
});

router.get("/", emailTestLimiter, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const result = await sendEmail({
      to: recipient,
      subject: "HOVIRA Vercel email test",
      html: "<p>This is a test email from the HOVIRA backend.</p>",
    });

    return res.status(200).json({
      success: true,
      message: "Email accepted by the SMTP server.",
      to: recipient,
      messageId: result.messageId,
      accepted: result.accepted,
    });
  } catch (error) {
    console.error("[EMAIL TEST ENDPOINT ERROR]", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

    return res.status(502).json({
      success: false,
      to: recipient,
      error: {
        message: error.message || "Email sending failed.",
        ...(error.code ? { code: error.code } : {}),
        ...(error.command ? { command: error.command } : {}),
        ...(error.responseCode ? { responseCode: error.responseCode } : {}),
        ...(error.response ? { response: error.response } : {}),
      },
    });
  }
});

module.exports = router;
