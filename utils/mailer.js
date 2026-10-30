
const nodemailer = require("nodemailer");

async function sendEmail({ to, subject, html }) {
  try {
    const port = Number(process.env.SMTP_PORT || 465);

    console.log("[EMAIL] Sending email...", {
      to,
      subject,
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      userConfigured: !!process.env.SMTP_USER,
      passConfigured: !!process.env.SMTP_PASS,
    });

    if (!to) {
      throw new Error("Email recipient is missing.");
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error(
        "Gmail SMTP configuration is incomplete. Set SMTP_USER to your Gmail address and SMTP_PASS to its app password."
      );
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("SMTP_PORT must be a valid port number.");
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure:
        process.env.SMTP_SECURE === undefined
          ? port === 465
          : process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
    });

    const result = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });

    console.log("[EMAIL] SMTP response:", {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response,
    });

    if (!result.accepted || result.accepted.length === 0) {
      throw new Error("SMTP server did not accept the recipient.");
    }

    console.log("[EMAIL] Email sent successfully");

    return {
      success: true,
      messageId: result.messageId,
      accepted: result.accepted,
    };

  } catch (err) {
    console.error("[EMAIL ERROR]", {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
    });

    throw err;
  }
}

module.exports = { sendEmail };
