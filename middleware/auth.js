const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Admin = require('../models/Admin');
const asyncHandler = require('./asyncHandler');

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

const protectCustomer = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'Authentication required.' });
  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ message: 'Invalid or expired token.' }); }
  if (decoded.role !== 'customer') return res.status(403).json({ message: 'Customer access required.' });
  const customer = await Customer.findById(decoded.id).select('-password');
  if (!customer || customer.status !== 'active') return res.status(401).json({ message: 'Customer account is unavailable.' });
  req.customer = customer;
  next();
});

const protectAdmin = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'Authentication required.' });
  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ message: 'Invalid or expired token.' }); }
  if (!['admin', 'superadmin'].includes(decoded.role)) return res.status(403).json({ message: 'Admin access required.' });
  const admin = await Admin.findById(decoded.id).select('-password');
  if (!admin || admin.status !== 'active') return res.status(401).json({ message: 'Admin account is unavailable.' });
  if (decoded.role === 'superadmin' && admin.role !== 'superadmin') return res.status(403).json({ message: 'Super admin access required.' });
  req.admin = admin;
  next();
});

const protectSuperAdmin = [protectAdmin, (req, res, next) => {
  if (req.admin.role !== 'superadmin') return res.status(403).json({ message: 'Super admin access required.' });
  next();
}];
module.exports = { protectCustomer, protectAdmin, protectSuperAdmin };
