# HOVIRA API route checklist

All routes use the `/api` prefix.

| Area | Method | Endpoint | Access |
|---|---|---|---|
| Health | GET | `/health` | Public |
| Admin auth | POST | `/auth/admin/login` | Public, rate-limited |
| Customer auth | POST | `/auth/customers/register` | Public, rate-limited |
| Customer auth | POST | `/auth/customers/login` | Public, rate-limited |
| Product | GET | `/products` | Public |
| Product | GET | `/products/:slugOrId` | Public |
| Product | POST | `/products` | Admin, multipart `images` |
| Product | POST | `/products/upload-images` | Admin, multipart `images` |
| Product | PUT | `/products/:id` | Admin, multipart optional `images` |
| Product | DELETE | `/products/:id` | Admin |
| Product image | DELETE | `/products/:id/images/:imageId` | Admin |
| Customer account | GET | `/customers/me` | Customer |
| Customer account | PATCH | `/customers/me` | Customer |
| Customer account | PATCH | `/customers/me/password` | Customer |
| Customer address | POST | `/customers/me/addresses` | Customer |
| Customer address | PATCH | `/customers/me/addresses/:addressId` | Customer |
| Customer address | DELETE | `/customers/me/addresses/:addressId` | Customer |
| Customer order history | GET | `/customers/me/orders` | Customer |
| Customer admin list | GET | `/customers` | Admin |
| Customer details | GET | `/customers/:id` | Admin |
| Customer moderation | PATCH | `/customers/:id` | Super admin |
| Coupon list | GET | `/coupons` | Public, active only |
| Coupon validation | POST | `/coupons/validate` | Customer |
| Coupon admin list | GET | `/coupons?admin=true` | Admin |
| Coupon create | POST | `/coupons` | Admin |
| Coupon update | PATCH | `/coupons/:id` | Admin |
| Coupon delete | DELETE | `/coupons/:id` | Admin |
| Order create | POST | `/orders` | Customer |
| My orders | GET | `/orders/my` | Customer |
| My order details | GET | `/orders/my/:id` | Customer, own orders only |
| Cancel order | PATCH | `/orders/my/:id/cancel` | Customer, eligible orders only |
| Admin order list | GET | `/orders` | Admin |
| Admin order details | GET | `/orders/:id` | Admin |
| Update order/payment/tracking | PATCH | `/orders/:id` | Admin |
| Super admin profile | GET | `/admin/profile` | Admin |
| Update admin profile/avatar | PATCH | `/admin/profile` | Admin, multipart optional `avatar` |
| Change admin password | PATCH | `/admin/profile/password` | Admin |
| Dashboard analytics | GET | `/admin/dashboard` | Admin |
| Admin users list | GET | `/admin/users` | Super admin |
| Create admin user | POST | `/admin/users` | Super admin |
| Update admin user | PATCH | `/admin/users/:id` | Super admin |

## Product create example
Use `multipart/form-data` for `POST /api/products`, with one or more file fields named `images`.

```text
name: Hovira Gold Premium Serum
sku: HOV-SER-001
price: 1299
salePrice: 999
category: Serums
shortDescription: Lightweight daily facial serum
description: A skincare serum for your daily routine.
content: <h2>About this serum</h2><p>Product page content...</p>
stock: 80
lowStockThreshold: 8
ingredients: ["Hyaluronic Acid", "Vitamin E"]
benefits: ["Hydration", "Soft-feeling skin"]
howToUse: Apply as directed on the product label.
tags: ["serum", "hydration", "hovira"]
seo: {"metaTitle":"Hovira Gold Premium Serum | HOVIRA","metaDescription":"Explore HOVIRA Gold Premium Serum for your skincare routine.","keywords":["Hovira serum","premium face serum"],"canonicalUrl":"https://example.com/products/hovira-gold-premium-serum"}
```

For arrays/objects in Postman form-data, send JSON strings. Use real product claims and ingredient lists only after verifying the actual product formulation.
