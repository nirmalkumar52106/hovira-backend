const mongoose = require('mongoose');
const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true, default: 'Home' }, fullName: { type: String, trim: true, required: true },
  phone: { type: String, trim: true, required: true }, addressLine1: { type: String, trim: true, required: true },
  addressLine2: { type: String, trim: true, default: '' }, landmark: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, required: true }, state: { type: String, trim: true, required: true },
  postalCode: { type: String, trim: true, required: true }, country: { type: String, trim: true, default: 'India' },
  isDefault: { type: Boolean, default: false },
}, { _id: true });
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true, default: '' }, password: { type: String, required: true, minlength: 8, select: false },
  avatar: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
  addresses: { type: [addressSchema], default: [] },
  status: { type: String, enum: ['active', 'blocked'], default: 'active', index: true },
  marketingOptIn: { type: Boolean, default: false }, lastLoginAt: { type: Date, default: null },
}, { timestamps: true });
customerSchema.pre('save', async function () { if (this.isModified('password')) { const bcrypt = require('bcryptjs'); this.password = await bcrypt.hash(this.password, 12); } });
customerSchema.methods.comparePassword = function (candidate) { return require('bcryptjs').compare(candidate, this.password); };
customerSchema.set('toJSON', { transform: (doc, ret) => { delete ret.password; delete ret.__v; return ret; } });
module.exports = mongoose.model('Customer', customerSchema);
