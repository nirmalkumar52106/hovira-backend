const { timingSafeEqual } = require("node:crypto");
const router = require("express").Router();
const { sendEmail } = require("../utils/mailer");

const recipient = "nirmalkumar52106@gmail.com";

router.post("/", async (req, res) => {
  const expectedToken = process.env.EMAIL_TEST_TOKEN;

  if (!expectedToken) {
    return res.status(503).json({
      success: false,
      error: { message: "Email test endpoint is not configured." },
    });
  }

  const authorization = req.get("authorization") || "";
  const suppliedToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  const expectedBuffer = Buffer.from(expectedToken);
  const suppliedBuffer = Buffer.from(suppliedToken);

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return res.status(401).json({
      success: false,
      error: { message: "A valid bearer token is required." },
    });
  }

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
