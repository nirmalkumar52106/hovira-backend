const mongoose = require('mongoose');
const slugify = require('slugify');
const imageSchema = new mongoose.Schema({ url: { type: String, required: true }, publicId: { type: String, required: true }, alt: { type: String, trim: true, default: '' }, isPrimary: { type: Boolean, default: false } }, { _id: true });
const variantSchema = new mongoose.Schema({ name: { type: String, trim: true, required: true }, value: { type: String, trim: true, required: true }, sku: { type: String, trim: true, default: '' }, price: { type: Number, min: 0 }, stock: { type: Number, min: 0, default: 0 } }, { _id: true });
const seoSchema = new mongoose.Schema({
  metaTitle: { type: String, trim: true, maxlength: 70, default: '' },
  metaDescription: { type: String, trim: true, maxlength: 320, default: '' },
  keywords: { type: [String], default: [] }, canonicalUrl: { type: String, trim: true, default: '' },
  ogTitle: { type: String, trim: true, default: '' }, ogDescription: { type: String, trim: true, default: '' }, ogImage: { type: String, trim: true, default: '' },
}, { _id: false });
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 180, index: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  shortDescription: { type: String, trim: true, maxlength: 500, default: '' },
  description: { type: String, required: true, trim: true },
  content: { type: String, trim: true, default: '' },
  ingredients: { type: [String], default: [] }, benefits: { type: [String], default: [] }, howToUse: { type: String, trim: true, default: '' }, warnings: { type: String, trim: true, default: '' },
  category: { type: String, required: true, trim: true, index: true }, brand: { type: String, trim: true, default: 'HOVIRA' },
  price: { type: Number, required: true, min: 0 }, salePrice: { type: Number, min: 0, default: null }, costPrice: { type: Number, min: 0, default: null },
  currency: { type: String, uppercase: true, default: 'INR' }, stock: { type: Number, min: 0, default: 0 }, lowStockThreshold: { type: Number, min: 0, default: 5 },
  images: { type: [imageSchema], default: [] }, variants: { type: [variantSchema], default: [] }, tags: { type: [String], default: [] },
  weightGrams: { type: Number, min: 0, default: null }, isFeatured: { type: Boolean, default: false }, isActive: { type: Boolean, default: true },
  seo: { type: seoSchema, default: () => ({}) }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });
productSchema.pre('validate', function () {
  if (this.name && !this.slug) this.slug = slugify(this.name, { lower: true, strict: true, trim: true });
  if (this.salePrice != null && this.salePrice > this.price) this.invalidate('salePrice', 'Sale price cannot be greater than regular price.');
  if (this.images?.length && !this.images.some(i => i.isPrimary)) this.images[0].isPrimary = true;
  if (this.images?.filter(i => i.isPrimary).length > 1) { let found = false; this.images.forEach(i => { if (i.isPrimary && !found) found = true; else if (i.isPrimary) i.isPrimary = false; }); }
});
productSchema.index({ name: 'text', shortDescription: 'text', description: 'text', content: 'text', tags: 'text' });
productSchema.virtual('effectivePrice').get(function () { return this.salePrice != null ? this.salePrice : this.price; });
productSchema.set('toJSON', { virtuals: true });
module.exports = mongoose.model('Product', productSchema);
