const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const adminSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, minlength: 8, select: false },
  phone: { type: String, trim: true, default: '' },
  avatar: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
  role: { type: String, enum: ['admin', 'superadmin'], default: 'admin', index: true },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });
adminSchema.pre('save', async function () { if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12); });
adminSchema.methods.comparePassword = function (candidate) { return bcrypt.compare(candidate, this.password); };
adminSchema.set('toJSON', { transform: (doc, ret) => { delete ret.password; delete ret.__v; return ret; } });
module.exports = mongoose.model('Admin', adminSchema);
