const Customer = require('../models/Customer');
const Admin = require('../models/Admin');
const signToken = require('../utils/token');
const asyncHandler = require('../middleware/asyncHandler');

exports.registerCustomer = asyncHandler(async (req, res) => {
  const { name, email, password, phone, marketingOptIn } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
  if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  const normalizedEmail = String(email).trim().toLowerCase();
  if (await Customer.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'An account with this email already exists.' });
  const customer = await Customer.create({ name, email: normalizedEmail, password, phone, marketingOptIn: Boolean(marketingOptIn) });
  res.status(201).json({ message: 'Customer registered successfully.', token: signToken(customer, 'customer'), customer: customer.toJSON() });
});
exports.loginCustomer = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
  const customer = await Customer.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
  if (!customer || !(await customer.comparePassword(password))) return res.status(401).json({ message: 'Invalid email or password.' });
  if (customer.status !== 'active') return res.status(403).json({ message: 'Your account is blocked. Contact support.' });
  customer.lastLoginAt = new Date(); await customer.save();
  res.json({ message: 'Login successful.', token: signToken(customer, 'customer'), customer: customer.toJSON() });
});
exports.loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
  const admin = await Admin.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
  if (!admin || !(await admin.comparePassword(password))) return res.status(401).json({ message: 'Invalid email or password.' });
  if (admin.status !== 'active') return res.status(403).json({ message: 'Admin account is disabled.' });
  admin.lastLoginAt = new Date(); await admin.save();
  res.json({ message: 'Admin login successful.', token: signToken(admin, admin.role), admin: admin.toJSON() });
});
