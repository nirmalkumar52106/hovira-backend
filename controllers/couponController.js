const Coupon = require('../models/Coupon');
const asyncHandler = require('../middleware/asyncHandler');
const { getPagination, paginated } = require('../utils/pagination');
exports.listCoupons = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query); const filter = {};
  if (req.query.admin !== 'true') { filter.isActive = true; const now = new Date(); filter.$and = [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] }]; }
  const [coupons, total] = await Promise.all([Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Coupon.countDocuments(filter)]);
  res.json(paginated(coupons, total, page, limit));
});
exports.createCoupon = asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.code || !b.discountType || b.discountValue === undefined) return res.status(400).json({ message: 'code, discountType and discountValue are required.' });
  const coupon = await Coupon.create({ ...b, code: String(b.code).trim().toUpperCase(), createdBy: req.admin._id });
  res.status(201).json({ message: 'Coupon created.', coupon });
});
exports.updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id); if (!coupon) return res.status(404).json({ message: 'Coupon not found.' });
  const allowed = ['description','discountType','discountValue','maxDiscount','minOrderAmount','startsAt','expiresAt','usageLimit','perCustomerLimit','applicableCategories','applicableProductIds','isActive'];
  allowed.forEach(k => { if (req.body[k] !== undefined) coupon[k] = req.body[k]; });
  if (req.body.code) coupon.code = String(req.body.code).trim().toUpperCase();
  await coupon.save(); res.json({ message: 'Coupon updated.', coupon });
});
exports.deleteCoupon = asyncHandler(async (req, res) => { const coupon = await Coupon.findById(req.params.id); if (!coupon) return res.status(404).json({ message: 'Coupon not found.' }); await coupon.deleteOne(); res.json({ message: 'Coupon deleted.' }); });
exports.validateCoupon = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase(); const subtotal = Number(req.body.subtotal); const productIds = (req.body.items || []).map(i => String(i.productId));
  if (!code || !Number.isFinite(subtotal) || subtotal < 0) return res.status(400).json({ message: 'Valid coupon code and subtotal are required.' });
  const coupon = await Coupon.findOne({ code, isActive: true }); if (!coupon) return res.status(404).json({ message: 'Coupon is invalid or inactive.' });
  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) return res.status(400).json({ message: 'Coupon is not active yet.' });
  if (coupon.expiresAt && now > coupon.expiresAt) return res.status(400).json({ message: 'Coupon has expired.' });
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ message: 'Coupon usage limit reached.' });
  if (subtotal < coupon.minOrderAmount) return res.status(400).json({ message: `Minimum order amount is ${coupon.minOrderAmount}.` });
  if (req.customer) { const usage = coupon.usedBy.find(u => String(u.customer) === String(req.customer._id)); if (usage && usage.count >= coupon.perCustomerLimit) return res.status(400).json({ message: 'You have reached this coupon usage limit.' }); }
  if (coupon.applicableProductIds.length && !productIds.some(id => coupon.applicableProductIds.some(pid => String(pid) === id))) return res.status(400).json({ message: 'Coupon does not apply to these products.' });
  let discount = coupon.discountType === 'percentage' ? subtotal * coupon.discountValue / 100 : coupon.discountValue;
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(Math.round(discount * 100) / 100, subtotal);
  res.json({ valid: true, code: coupon.code, discount, payableSubtotal: Math.max(0, subtotal - discount), message: 'Coupon applied.' });
});
module.exports = exports;
