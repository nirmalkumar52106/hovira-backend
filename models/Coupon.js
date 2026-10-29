const mongoose = require('mongoose');
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  description: { type: String, trim: true, default: '' },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true, min: 0 }, maxDiscount: { type: Number, min: 0, default: null },
  minOrderAmount: { type: Number, min: 0, default: 0 }, startsAt: { type: Date, default: null }, expiresAt: { type: Date, default: null },
  usageLimit: { type: Number, min: 1, default: null }, perCustomerLimit: { type: Number, min: 1, default: 1 },
  usedCount: { type: Number, min: 0, default: 0 }, usedBy: [{ customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, count: { type: Number, default: 0 } }],
  applicableCategories: { type: [String], default: [] }, applicableProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  isActive: { type: Boolean, default: true }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });
couponSchema.pre('validate', function () { if (this.discountType === 'percentage' && this.discountValue > 100) this.invalidate('discountValue', 'Percentage discount cannot exceed 100.'); });
module.exports = mongoose.model('Coupon', couponSchema);
