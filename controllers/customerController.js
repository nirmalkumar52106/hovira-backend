const Customer = require('../models/Customer');
const Order = require('../models/Order');
const asyncHandler = require('../middleware/asyncHandler');
const { getPagination, paginated } = require('../utils/pagination');
const safeCustomer = (customer) => { const obj = customer.toObject ? customer.toObject() : customer; delete obj.password; return obj; };
exports.getMe = asyncHandler(async (req, res) => res.json({ customer: req.customer }));
exports.updateMe = asyncHandler(async (req, res) => {
  const { name, phone, marketingOptIn } = req.body;
  if (name !== undefined) req.customer.name = name;
  if (phone !== undefined) req.customer.phone = phone;
  if (marketingOptIn !== undefined) req.customer.marketingOptIn = Boolean(marketingOptIn);
  await req.customer.save(); res.json({ message: 'Profile updated.', customer: safeCustomer(req.customer) });
});
exports.changePassword = asyncHandler(async (req, res) => {
  const bcrypt = require('bcryptjs'); const customer = await Customer.findById(req.customer._id).select('+password');
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || String(newPassword).length < 8) return res.status(400).json({ message: 'Current password and a new password of at least 8 characters are required.' });
  if (!(await customer.comparePassword(currentPassword))) return res.status(400).json({ message: 'Current password is incorrect.' });
  customer.password = newPassword; await customer.save(); res.json({ message: 'Password changed successfully. Please sign in again on other devices.' });
});
exports.addAddress = asyncHandler(async (req, res) => {
  const address = req.body;
  const required = ['fullName','phone','addressLine1','city','state','postalCode'];
  if (required.some(k => !address[k])) return res.status(400).json({ message: `Required address fields: ${required.join(', ')}` });
  if (address.isDefault) req.customer.addresses.forEach(a => { a.isDefault = false; });
  if (!req.customer.addresses.length) address.isDefault = true;
  req.customer.addresses.push(address); await req.customer.save();
  res.status(201).json({ message: 'Address added.', addresses: req.customer.addresses });
});
exports.updateAddress = asyncHandler(async (req, res) => {
  const address = req.customer.addresses.id(req.params.addressId);
  if (!address) return res.status(404).json({ message: 'Address not found.' });
  if (req.body.isDefault) req.customer.addresses.forEach(a => { a.isDefault = false; });
  Object.assign(address, req.body); await req.customer.save(); res.json({ message: 'Address updated.', addresses: req.customer.addresses });
});
exports.deleteAddress = asyncHandler(async (req, res) => {
  const address = req.customer.addresses.id(req.params.addressId);
  if (!address) return res.status(404).json({ message: 'Address not found.' });
  const wasDefault = address.isDefault; address.deleteOne();
  if (wasDefault && req.customer.addresses.length) req.customer.addresses[0].isDefault = true;
  await req.customer.save(); res.json({ message: 'Address deleted.', addresses: req.customer.addresses });
});
exports.myOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query); const filter = { customer: req.customer._id };
  const [orders, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Order.countDocuments(filter)]);
  res.json(paginated(orders, total, page, limit));
});
exports.adminListCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query); const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) { const q = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }]; }
  const [customers, total] = await Promise.all([Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Customer.countDocuments(filter)]);
  res.json(paginated(customers, total, page, limit));
});
exports.adminGetCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });
  const [orderCount, orderTotals] = await Promise.all([Order.countDocuments({ customer: customer._id }), Order.aggregate([{ $match: { customer: customer._id, paymentStatus: 'paid' } }, { $group: { _id: null, totalSpent: { $sum: '$total' } } }])]);
  res.json({ customer, stats: { orderCount, totalSpent: orderTotals[0]?.totalSpent || 0 } });
});
exports.adminUpdateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });
  if (req.body.status && !['active', 'blocked'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid customer status.' });
  if (req.body.status) customer.status = req.body.status;
  if (req.body.name !== undefined) customer.name = req.body.name;
  if (req.body.phone !== undefined) customer.phone = req.body.phone;
  await customer.save(); res.json({ message: 'Customer updated.', customer });
});
