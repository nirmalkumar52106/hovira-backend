const Admin = require('../models/Admin'); const Product = require('../models/Product'); const Customer = require('../models/Customer'); const Order = require('../models/Order');
const asyncHandler = require('../middleware/asyncHandler'); const { uploadBuffer, deleteImage } = require('../utils/cloudinaryUpload');
exports.getProfile = asyncHandler(async (req, res) => res.json({ admin: req.admin }));
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body; if (name !== undefined) req.admin.name = name; if (phone !== undefined) req.admin.phone = phone;
  if (req.file) { const image = await uploadBuffer(req.file.buffer, 'hovira/admin'); if (req.admin.avatar?.publicId) await deleteImage(req.admin.avatar.publicId).catch(() => null); req.admin.avatar = image; }
  await req.admin.save(); res.json({ message: 'Profile updated.', admin: req.admin });
});
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || String(newPassword).length < 12) return res.status(400).json({ message: 'Current password and a new password of at least 12 characters are required.' });
  const admin = await Admin.findById(req.admin._id).select('+password');
  if (!(await admin.comparePassword(currentPassword))) return res.status(400).json({ message: 'Current password is incorrect.' });
  admin.password = newPassword; await admin.save(); res.json({ message: 'Password changed. Sign in again with the new password.' });
});
exports.dashboard = asyncHandler(async (req, res) => {
  const now = new Date(); const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1); const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidMatch = { paymentStatus: 'paid' };
  const [totalProducts, activeProducts, totalCustomers, totalOrders, pendingOrders, lowStockProducts, todaySales, monthSales, lastMonthSales, recentOrders, categorySales] = await Promise.all([
    Product.countDocuments(), Product.countDocuments({ isActive: true }), Customer.countDocuments(), Order.countDocuments(), Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'processing'] } }),
    Product.find({ isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }).select('name sku stock lowStockThreshold images').sort({ stock: 1 }).limit(10),
    Order.aggregate([{ $match: { ...paidMatch, createdAt: { $gte: startToday } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { ...paidMatch, createdAt: { $gte: startMonth } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { ...paidMatch, createdAt: { $gte: startLastMonth, $lt: endLastMonth } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    Order.find().populate('customer', 'name email').sort({ createdAt: -1 }).limit(8).select('orderNumber customer total status paymentStatus createdAt'),
    Order.aggregate([{ $match: { ...paidMatch, createdAt: { $gte: startMonth } } }, { $unwind: '$items' }, { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'product' } }, { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } }, { $group: { _id: { $ifNull: ['$product.category', 'Unknown'] }, sales: { $sum: '$items.lineTotal' }, quantity: { $sum: '$items.quantity' } } }, { $sort: { sales: -1 } }, { $limit: 6 }])
  ]);
  const thisMonth = monthSales[0] || { total: 0, count: 0 }; const lastMonth = lastMonthSales[0] || { total: 0, count: 0 };
  const growthPercent = lastMonth.total ? Math.round(((thisMonth.total - lastMonth.total) / lastMonth.total) * 10000) / 100 : null;
  res.json({ currency: process.env.CURRENCY || 'INR', stats: { totalProducts, activeProducts, totalCustomers, totalOrders, pendingOrders, todaySales: todaySales[0] || { total: 0, count: 0 }, thisMonthSales: thisMonth, lastMonthSales: lastMonth, salesGrowthPercent: growthPercent }, lowStockProducts, recentOrders, topCategories: categorySales });
});
exports.listAdmins = asyncHandler(async (req, res) => { const admins = await Admin.find().sort({ createdAt: -1 }); res.json({ admins }); });
exports.createAdmin = asyncHandler(async (req, res) => { const { name, email, password, phone, role = 'admin' } = req.body; if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' }); if (String(password).length < 12) return res.status(400).json({ message: 'Admin password must be at least 12 characters.' }); if (!['admin', 'superadmin'].includes(role)) return res.status(400).json({ message: 'Invalid role.' }); const admin = await Admin.create({ name, email: String(email).toLowerCase().trim(), password, phone, role }); res.status(201).json({ message: 'Admin created.', admin }); });
exports.updateAdmin = asyncHandler(async (req, res) => { const admin = await Admin.findById(req.params.id); if (!admin) return res.status(404).json({ message: 'Admin not found.' }); if (String(admin._id) === String(req.admin._id) && req.body.status === 'disabled') return res.status(400).json({ message: 'You cannot disable your own account.' }); if (req.body.name !== undefined) admin.name = req.body.name; if (req.body.phone !== undefined) admin.phone = req.body.phone; if (req.body.status !== undefined) admin.status = req.body.status; if (req.body.role && ['admin', 'superadmin'].includes(req.body.role)) admin.role = req.body.role; await admin.save(); res.json({ message: 'Admin updated.', admin }); });
