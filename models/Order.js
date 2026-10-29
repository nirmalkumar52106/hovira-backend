const mongoose = require('mongoose');
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, name: { type: String, required: true }, slug: { type: String, default: '' }, sku: { type: String, default: '' },
  image: { type: String, default: '' }, variant: { type: String, default: '' }, unitPrice: { type: Number, required: true, min: 0 }, quantity: { type: Number, required: true, min: 1 }, lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false });
const addressSnapshotSchema = new mongoose.Schema({ fullName: String, phone: String, addressLine1: String, addressLine2: String, landmark: String, city: String, state: String, postalCode: String, country: String }, { _id: false });
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true }, customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  items: { type: [orderItemSchema], required: true, validate: v => v.length > 0 }, shippingAddress: { type: addressSnapshotSchema, required: true }, billingAddress: { type: addressSnapshotSchema, default: null },
  subtotal: { type: Number, required: true, min: 0 }, discount: { type: Number, default: 0, min: 0 }, shippingFee: { type: Number, default: 0, min: 0 }, tax: { type: Number, default: 0, min: 0 }, total: { type: Number, required: true, min: 0 },
  coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null }, couponCode: { type: String, default: '' }, currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'], default: 'pending', index: true },
  paymentMethod: { type: String, enum: ['cod', 'online', 'upi', 'card', 'netbanking'], default: 'cod' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'], default: 'pending', index: true },
  paymentReference: { type: String, default: '' }, trackingNumber: { type: String, default: '' }, carrier: { type: String, default: '' }, customerNote: { type: String, default: '' }, adminNote: { type: String, default: '' },
  statusHistory: [{ status: String, note: String, changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }, changedAt: { type: Date, default: Date.now } }],
  cancelledAt: { type: Date, default: null }, deliveredAt: { type: Date, default: null },
}, { timestamps: true });
orderSchema.index({ createdAt: -1 });
module.exports = mongoose.model('Order', orderSchema);
