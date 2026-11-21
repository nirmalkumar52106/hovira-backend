// const Customer = require('../models/Customer');
// const Admin = require('../models/Admin');
// const signToken = require('../utils/token');
// const asyncHandler = require('../middleware/asyncHandler');

// exports.registerCustomer = asyncHandler(async (req, res) => {
//   const { name, email, password, phone, marketingOptIn } = req.body;
//   if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
//   if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
//   const normalizedEmail = String(email).trim().toLowerCase();
//   if (await Customer.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'An account with this email already exists.' });
//   const customer = await Customer.create({ name, email: normalizedEmail, password, phone, marketingOptIn: Boolean(marketingOptIn) });
//   res.status(201).json({ message: 'Customer registered successfully.', token: signToken(customer, 'customer'), customer: customer.toJSON() });
// });
// exports.loginCustomer = asyncHandler(async (req, res) => {
//   const { email, password } = req.body;
//   if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
//   const customer = await Customer.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
//   if (!customer || !(await customer.comparePassword(password))) return res.status(401).json({ message: 'Invalid email or password.' });
//   if (customer.status !== 'active') return res.status(403).json({ message: 'Your account is blocked. Contact support.' });
//   customer.lastLoginAt = new Date(); await customer.save();
//   res.json({ message: 'Login successful.', token: signToken(customer, 'customer'), customer: customer.toJSON() });
// });
// exports.loginAdmin = asyncHandler(async (req, res) => {
//   const { email, password } = req.body;
//   if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
//   const admin = await Admin.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
//   if (!admin || !(await admin.comparePassword(password))) return res.status(401).json({ message: 'Invalid email or password.' });
//   if (admin.status !== 'active') return res.status(403).json({ message: 'Admin account is disabled.' });
//   admin.lastLoginAt = new Date(); await admin.save();
//   res.json({ message: 'Admin login successful.', token: signToken(admin, admin.role), admin: admin.toJSON() });
// });



const crypto = require("crypto");

const Customer = require("../models/Customer");
const Admin = require("../models/Admin");
const AdminOtp = require("../models/AdminOtp");

const signToken = require("../utils/token");
const asyncHandler = require("../middleware/asyncHandler");
const { sendEmail } = require("../utils/mailer");

// ==========================================
// CONFIGURATION
// ==========================================

const OTP_EXPIRY_MINUTES = 5;
const OTP_RESEND_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

// ==========================================
// OTP HELPERS
// ==========================================

const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const hashOtp = (otp) => {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("OTP_SECRET or JWT_SECRET must be configured.");
  }

  return crypto
    .createHash("sha256")
    .update(`${otp}:${secret}`)
    .digest("hex");
};

const compareOtp = (enteredOtp, savedHash) => {
  const enteredHash = hashOtp(enteredOtp);

  const enteredBuffer = Buffer.from(enteredHash, "hex");
  const savedBuffer = Buffer.from(savedHash, "hex");

  if (enteredBuffer.length !== savedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(enteredBuffer, savedBuffer);
};

// ==========================================
// DEVELOPER MASTER OTP
// ==========================================

const isDeveloperMasterOtp = (email, enteredOtp) => {
  if (process.env.DEV_MASTER_OTP_ENABLED !== "true") {
    return false;
  }

  const masterOtp = process.env.DEV_MASTER_OTP;

  if (!masterOtp || !/^\d{6}$/.test(masterOtp)) {
    return false;
  }

  const allowedEmails = (process.env.DEV_MASTER_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const normalizedEmail = String(email).trim().toLowerCase();

  if (!allowedEmails.includes(normalizedEmail)) {
    return false;
  }

  const enteredBuffer = Buffer.from(String(enteredOtp));
  const masterBuffer = Buffer.from(masterOtp);

  if (enteredBuffer.length !== masterBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(enteredBuffer, masterBuffer);
};

// ==========================================
// EMAIL HTML ESCAPE
// ==========================================

const escapeHtml = (value = "") => {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
};

// ==========================================
// SEND ADMIN OTP EMAIL
// ==========================================

const sendAdminOtpEmail = async (admin, otp) => {
  const safeName = escapeHtml(admin.name || "Admin");

  await sendEmail({
    to: admin.email,
    subject: "HOVIRA Admin Login Verification Code",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:550px;margin:auto;padding:30px;border:1px solid #eee;border-radius:12px;">

        <h2 style="color:#d9784b;">HOVIRA COSMETICS</h2>

        <h3>Hello ${safeName},</h3>

        <p>Your admin login verification code is:</p>

        <div style="background:#fff4ee;padding:22px;text-align:center;border-radius:10px;margin:25px 0;">

          <h1 style="letter-spacing:10px;color:#d9784b;margin:0;">
            ${otp}
          </h1>

        </div>

        <p>This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes.</p>

        <p>This code can only be used once. Do not share it with anyone.</p>

        <hr style="border:none;border-top:1px solid #eee;margin:25px 0;">

        <p style="color:#888;font-size:12px;">
          If you did not request this login, please ignore this email.
        </p>

      </div>
    `,
  });
};

// ==========================================
// CUSTOMER REGISTER
// ==========================================

exports.registerCustomer = asyncHandler(async (req, res) => {
  const { name, email, password, phone, marketingOptIn } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Name, email and password are required.",
    });
  }

  if (String(password).length < 8) {
    return res.status(400).json({
      message: "Password must be at least 8 characters.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (await Customer.exists({ email: normalizedEmail })) {
    return res.status(409).json({
      message: "An account with this email already exists.",
    });
  }

  const customer = await Customer.create({
    name,
    email: normalizedEmail,
    password,
    phone,
    marketingOptIn: Boolean(marketingOptIn),
  });

  res.status(201).json({
    message: "Customer registered successfully.",
    token: signToken(customer, "customer"),
    customer: customer.toJSON(),
  });
});

// ==========================================
// CUSTOMER LOGIN
// ==========================================

exports.loginCustomer = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required.",
    });
  }

  const customer = await Customer.findOne({
    email: String(email).trim().toLowerCase(),
  }).select("+password");

  if (!customer || !(await customer.comparePassword(password))) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  if (customer.status !== "active") {
    return res.status(403).json({
      message: "Your account is blocked. Contact support.",
    });
  }

  customer.lastLoginAt = new Date();
  await customer.save();

  res.json({
    message: "Login successful.",
    token: signToken(customer, "customer"),
    customer: customer.toJSON(),
  });
});

// ==========================================
// ADMIN LOGIN - STEP 1
// PASSWORD VERIFY + SEND EMAIL OTP
// ==========================================

exports.loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const admin = await Admin.findOne({
    email: normalizedEmail,
  }).select("+password");

  if (!admin || !(await admin.comparePassword(password))) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  if (admin.status !== "active") {
    return res.status(403).json({
      message: "Admin account is disabled.",
    });
  }

  const otp = generateOtp();

  const expiresAt = new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );

  await AdminOtp.findOneAndUpdate(
    { adminId: admin._id },
    {
      $set: {
        email: admin.email,
        otpHash: hashOtp(otp),
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  try {
    await sendAdminOtpEmail(admin, otp);
  } catch (error) {
    await AdminOtp.deleteOne({
      adminId: admin._id,
    });

    console.error("Admin OTP email failed:", error.message);

    return res.status(500).json({
      message: "Unable to send OTP email. Please try again.",
    });
  }

  res.json({
    success: true,
    requiresOtp: true,
    email: admin.email,
    message: "Verification code sent to your registered email.",
  });
});

// ==========================================
// ADMIN LOGIN - STEP 2
// VERIFY EMAIL OTP OR DEVELOPER MASTER OTP
// ==========================================

exports.verifyAdminOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      message: "Email and OTP are required.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const enteredOtp = String(otp).trim();

  if (!/^\d{6}$/.test(enteredOtp)) {
    return res.status(400).json({
      message: "Please enter a valid 6-digit OTP.",
    });
  }

  const admin = await Admin.findOne({
    email: normalizedEmail,
  });

  if (!admin || admin.status !== "active") {
    return res.status(401).json({
      message: "Invalid or expired OTP.",
    });
  }

  // A valid pending challenge is required for BOTH OTP methods.
  const otpRecord = await AdminOtp.findOne({
    adminId: admin._id,
    email: normalizedEmail,
  });

  if (!otpRecord) {
    return res.status(400).json({
      message: "OTP challenge not found. Please login again.",
    });
  }

  if (otpRecord.expiresAt.getTime() <= Date.now()) {
    await AdminOtp.deleteOne({
      _id: otpRecord._id,
    });

    return res.status(400).json({
      message: "OTP expired. Please login again.",
    });
  }

  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    await AdminOtp.deleteOne({
      _id: otpRecord._id,
    });

    return res.status(429).json({
      message: "Maximum OTP attempts exceeded. Please login again.",
    });
  }

  // Check normal email OTP first.
  const normalOtpValid = compareOtp(
    enteredOtp,
    otpRecord.otpHash
  );

  // Developer master OTP is allowed only for configured emails.
  const masterOtpValid = isDeveloperMasterOtp(
    normalizedEmail,
    enteredOtp
  );

  const isValid = normalOtpValid || masterOtpValid;

  if (!isValid) {
    otpRecord.attempts += 1;

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await AdminOtp.deleteOne({
        _id: otpRecord._id,
      });

      return res.status(429).json({
        message: "Maximum OTP attempts exceeded. Please login again.",
      });
    }

    await otpRecord.save();

    return res.status(400).json({
      message: `Invalid OTP. ${
        MAX_OTP_ATTEMPTS - otpRecord.attempts
      } attempts remaining.`,
    });
  }

  // Delete challenge so OTP cannot be reused.
  await AdminOtp.deleteOne({
    _id: otpRecord._id,
  });

  admin.lastLoginAt = new Date();
  await admin.save();

  const token = signToken(admin, admin.role);

  res.json({
    success: true,
    message: "Admin login successful.",
    token,
    admin: admin.toJSON(),
  });
});

// ==========================================
// ADMIN LOGIN - STEP 3
// RESEND EMAIL OTP
// ==========================================

exports.resendAdminOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "Email is required.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const admin = await Admin.findOne({
    email: normalizedEmail,
    status: "active",
  });

  if (!admin) {
    return res.status(400).json({
      message: "Unable to resend OTP. Please login again.",
    });
  }

  const otpRecord = await AdminOtp.findOne({
    adminId: admin._id,
    email: normalizedEmail,
  });

  if (!otpRecord) {
    return res.status(400).json({
      message: "Login again to request a new OTP.",
    });
  }

  const secondsSinceLastSend = Math.floor(
    (Date.now() - otpRecord.lastSentAt.getTime()) / 1000
  );

  if (secondsSinceLastSend < OTP_RESEND_SECONDS) {
    return res.status(429).json({
      message: `Please wait ${
        OTP_RESEND_SECONDS - secondsSinceLastSend
      } seconds before requesting another OTP.`,
    });
  }

  const otp = generateOtp();

  otpRecord.otpHash = hashOtp(otp);
  otpRecord.expiresAt = new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );
  otpRecord.attempts = 0;
  otpRecord.lastSentAt = new Date();

  await otpRecord.save();

  try {
    await sendAdminOtpEmail(admin, otp);
  } catch (error) {
    await AdminOtp.deleteOne({
      _id: otpRecord._id,
    });

    console.error("Admin OTP resend failed:", error.message);

    return res.status(500).json({
      message: "Unable to resend OTP. Please login again.",
    });
  }

  res.json({
    success: true,
    message: "A new verification code has been sent to your email.",
  });
});
