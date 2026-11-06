

// const Product = require("../models/Product");
// const asyncHandler = require("../middleware/asyncHandler");

// const {
//   sendNewProductLaunchEmails,
// } = require("../utils/productLaunchEmail");

// const {
//   getPagination,
//   paginated,
// } = require("../utils/pagination");

// const {
//   uploadBuffer,
//   deleteImage,
// } = require("../utils/cloudinaryUpload");

// const slugify = require("slugify");

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// const parseArray = (value) => {
//   if (Array.isArray(value)) return value;

//   if (typeof value !== "string" || !value.trim()) {
//     return [];
//   }

//   try {
//     const parsed = JSON.parse(value);
//     return Array.isArray(parsed) ? parsed : [value];
//   } catch {
//     return value
//       .split(",")
//       .map((s) => s.trim())
//       .filter(Boolean);
//   }
// };

// const bool = (value) =>
//   value === true || value === "true" || value === "1";

// const escapeRegex = (value) =>
//   String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// const makeUniqueSlug = async (name, excludeId) => {
//   const base =
//     slugify(name, {
//       lower: true,
//       strict: true,
//       trim: true,
//     }) || "product";

//   let slug = base;
//   let n = 1;

//   while (
//     await Product.exists({
//       slug,
//       ...(excludeId
//         ? { _id: { $ne: excludeId } }
//         : {}),
//     })
//   ) {
//     slug = `${base}-${++n}`;
//   }

//   return slug;
// };

// // ============================================
// // GET ALL PRODUCTS
// // ============================================

// exports.listProducts = asyncHandler(async (req, res) => {
//   const { page, limit, skip } = getPagination(req.query);

//   const filter = {};

//   if (req.query.admin !== "true") {
//     filter.isActive = true;
//   }

//   if (req.query.category) {
//     filter.category = new RegExp(
//       `^${escapeRegex(req.query.category)}$`,
//       "i"
//     );
//   }

//   if (req.query.featured !== undefined) {
//     filter.isFeatured = req.query.featured === "true";
//   }

//   if (req.query.inStock === "true") {
//     filter.stock = { $gt: 0 };
//   }

//   if (req.query.q) {
//     filter.$text = {
//       $search: String(req.query.q),
//     };
//   }

//   if (req.query.minPrice || req.query.maxPrice) {
//     filter.price = {
//       ...(req.query.minPrice
//         ? { $gte: Number(req.query.minPrice) }
//         : {}),
//       ...(req.query.maxPrice
//         ? { $lte: Number(req.query.maxPrice) }
//         : {}),
//     };
//   }

//   const sortMap = {
//     newest: { createdAt: -1 },
//     oldest: { createdAt: 1 },
//     price_asc: { price: 1 },
//     price_desc: { price: -1 },
//     name: { name: 1 },
//   };

//   const sort = sortMap[req.query.sort] || {
//     createdAt: -1,
//   };

//   const [items, total] = await Promise.all([
//     Product.find(filter)
//       .sort(sort)
//       .skip(skip)
//       .limit(limit),

//     Product.countDocuments(filter),
//   ]);

//   res.json(paginated(items, total, page, limit));
// });

// // ============================================
// // GET SINGLE PRODUCT
// // ============================================

// exports.getProduct = asyncHandler(async (req, res) => {
//   const key = req.params.slugOrId;

//   const product = await Product.findOne({
//     $or: [
//       { slug: key },
//       ...( /^[a-f\d]{24}$/i.test(key)
//         ? [{ _id: key }]
//         : []),
//     ],
//     ...(req.admin ? {} : { isActive: true }),
//   });

//   if (!product) {
//     return res.status(404).json({
//       message: "Product not found.",
//     });
//   }

//   res.json({ product });
// });

// // ============================================
// // CREATE PRODUCT + AUTOMATIC LAUNCH EMAIL
// // ============================================

// exports.createProduct = asyncHandler(async (req, res) => {
//   const body = req.body;

//   if (
//     !body.name ||
//     !body.sku ||
//     body.price === undefined ||
//     !body.category ||
//     !body.description
//   ) {
//     return res.status(400).json({
//       message:
//         "name, sku, price, category and description are required.",
//     });
//   }

//   const uploaded = [];

//   try {
//     // Upload images to Cloudinary
//     for (const file of req.files || []) {
//       uploaded.push(
//         await uploadBuffer(file.buffer)
//       );
//     }

//     let images = uploaded.map((im, i) => ({
//       ...im,
//       alt: body.imageAlt || body.name,
//       isPrimary: i === 0,
//     }));

//     if (body.images) {
//       const provided = parseArray(body.images).filter(
//         (x) => x && x.url && x.publicId
//       );

//       images = [...images, ...provided];
//     }

//     const seoInput = body.seo
//       ? typeof body.seo === "string"
//         ? JSON.parse(body.seo)
//         : body.seo
//       : {};

//     // Save product in MongoDB
//     const product = await Product.create({
//       name: body.name,

//       slug: await makeUniqueSlug(
//         body.slug || body.name
//       ),

//       sku: String(body.sku).toUpperCase(),

//       shortDescription: body.shortDescription,
//       description: body.description,
//       content: body.content,

//       ingredients: parseArray(body.ingredients),
//       benefits: parseArray(body.benefits),

//       howToUse: body.howToUse,
//       warnings: body.warnings,

//       category: body.category,
//       brand: body.brand || "HOVIRA",

//       price: Number(body.price),

//       salePrice:
//         body.salePrice === "" || body.salePrice == null
//           ? null
//           : Number(body.salePrice),

//       costPrice:
//         body.costPrice === "" || body.costPrice == null
//           ? null
//           : Number(body.costPrice),

//       stock: Number(body.stock || 0),

//       lowStockThreshold: Number(
//         body.lowStockThreshold ?? 5
//       ),

//       currency:
//         body.currency ||
//         process.env.CURRENCY ||
//         "INR",

//       images,

//       variants: parseArray(body.variants),
//       tags: parseArray(body.tags),

//       weightGrams: body.weightGrams
//         ? Number(body.weightGrams)
//         : null,

//       isFeatured: bool(body.isFeatured),

//       isActive:
//         body.isActive === undefined
//           ? true
//           : bool(body.isActive),

//       seo: seoInput,

//       createdBy: req.admin?._id,

//       // Newsletter tracking
//       launchEmailStatus: "not_sent",

//       launchEmailStats: {
//         total: 0,
//         sent: 0,
//         failed: 0,
//       },
//     });

//     // ========================================
//     // AUTOMATIC PRODUCT LAUNCH EMAIL
//     // ========================================

//     let launchEmailStats = {
//       total: 0,
//       sent: 0,
//       failed: 0,
//     };

//     if (product.isActive) {
//       try {
//         console.log(
//           "[HOVIRA] Starting product launch emails:",
//           product.name
//         );

//         launchEmailStats =
//           await sendNewProductLaunchEmails(product);

//         product.launchEmailStats = launchEmailStats;

//         if (launchEmailStats.total === 0) {
//           product.launchEmailStatus = "not_sent";
//         } else if (launchEmailStats.failed === 0) {
//           product.launchEmailStatus = "sent";
//         } else if (launchEmailStats.sent > 0) {
//           product.launchEmailStatus = "partial";
//         } else {
//           product.launchEmailStatus = "failed";
//         }

//         if (launchEmailStats.sent > 0) {
//           product.launchEmailSentAt = new Date();
//         }

//         await product.save();

//         console.log(
//           "[HOVIRA] Product launch email result:",
//           launchEmailStats
//         );
//       } catch (emailError) {
//         console.error(
//           "[HOVIRA] Product launch email failed:",
//           emailError.message
//         );

//         product.launchEmailStatus = "failed";

//         await product.save().catch((err) => {
//           console.error(
//             "Product email status save failed:",
//             err.message
//           );
//         });
//       }
//     }

//     // ========================================
//     // RESPONSE
//     // ========================================

//     return res.status(201).json({
//       message: "Product created successfully.",

//       product,

//       launchEmailStats,
//     });
//   } catch (error) {
//     // Delete uploaded Cloudinary images if product creation fails
//     await Promise.all(
//       uploaded.map((i) =>
//         deleteImage(i.publicId).catch(() => null)
//       )
//     );

//     throw error;
//   }
// });

// // ============================================
// // UPDATE PRODUCT
// // ============================================

// exports.updateProduct = asyncHandler(async (req, res) => {
//   const product = await Product.findById(req.params.id);

//   if (!product) {
//     return res.status(404).json({
//       message: "Product not found.",
//     });
//   }

//   const b = req.body;
//   const uploaded = [];

//   try {
//     for (const file of req.files || []) {
//       uploaded.push(
//         await uploadBuffer(file.buffer)
//       );
//     }

//     const allowed = [
//       "name",
//       "shortDescription",
//       "description",
//       "content",
//       "howToUse",
//       "warnings",
//       "category",
//       "brand",
//       "currency",
//     ];

//     allowed.forEach((k) => {
//       if (b[k] !== undefined) {
//         product[k] = b[k];
//       }
//     });

//     if (b.name && b.name !== product.name) {
//       product.slug = await makeUniqueSlug(
//         b.slug || b.name,
//         product._id
//       );
//     } else if (b.slug) {
//       product.slug = await makeUniqueSlug(
//         b.slug,
//         product._id
//       );
//     }

//     if (b.sku !== undefined) {
//       product.sku = String(b.sku).toUpperCase();
//     }

//     [
//       "price",
//       "stock",
//       "lowStockThreshold",
//       "weightGrams",
//       "costPrice",
//       "salePrice",
//     ].forEach((k) => {
//       if (b[k] !== undefined) {
//         product[k] =
//           b[k] === "" || b[k] === null
//             ? null
//             : Number(b[k]);
//       }
//     });

//     [
//       "ingredients",
//       "benefits",
//       "tags",
//       "variants",
//     ].forEach((k) => {
//       if (b[k] !== undefined) {
//         product[k] = parseArray(b[k]);
//       }
//     });

//     [
//       "isFeatured",
//       "isActive",
//     ].forEach((k) => {
//       if (b[k] !== undefined) {
//         product[k] = bool(b[k]);
//       }
//     });

//     if (b.seo !== undefined) {
//       product.seo =
//         typeof b.seo === "string"
//           ? JSON.parse(b.seo)
//           : b.seo;
//     }

//     if (b.images !== undefined) {
//       product.images = parseArray(b.images).filter(
//         (x) => x && x.url && x.publicId
//       );
//     }

//     uploaded.forEach((im, i) => {
//       product.images.push({
//         ...im,
//         alt: b.imageAlt || product.name,
//         isPrimary:
//           product.images.length === 0 && i === 0,
//       });
//     });

//     await product.save();

//     res.json({
//       message: "Product updated successfully.",
//       product,
//     });
//   } catch (error) {
//     await Promise.all(
//       uploaded.map((i) =>
//         deleteImage(i.publicId).catch(() => null)
//       )
//     );

//     throw error;
//   }
// });

// // ============================================
// // DELETE PRODUCT
// // ============================================

// exports.deleteProduct = asyncHandler(async (req, res) => {
//   const product = await Product.findById(req.params.id);

//   if (!product) {
//     return res.status(404).json({
//       message: "Product not found.",
//     });
//   }

//   await product.deleteOne();

//   await Promise.all(
//     product.images.map((i) =>
//       deleteImage(i.publicId).catch((err) =>
//         console.error(
//           "Cloudinary delete failed:",
//           err.message
//         )
//       )
//     )
//   );

//   res.json({
//     message: "Product and associated Cloudinary images deleted.",
//   });
// });

// // ============================================
// // UPLOAD PRODUCT IMAGES
// // ============================================

// exports.uploadProductImages = asyncHandler(async (req, res) => {
//   if (!req.files?.length) {
//     return res.status(400).json({
//       message: "Select at least one image.",
//     });
//   }

//   const uploaded = [];

//   try {
//     for (const file of req.files) {
//       uploaded.push(
//         await uploadBuffer(file.buffer)
//       );
//     }

//     res.status(201).json({
//       message: "Images uploaded to Cloudinary.",
//       images: uploaded,
//     });
//   } catch (e) {
//     await Promise.all(
//       uploaded.map((i) =>
//         deleteImage(i.publicId).catch(() => null)
//       )
//     );

//     throw e;
//   }
// });

// // ============================================
// // DELETE PRODUCT IMAGE
// // ============================================

// exports.deleteProductImage = asyncHandler(async (req, res) => {
//   const { imageId } = req.params;

//   const product = await Product.findById(req.params.id);

//   if (!product) {
//     return res.status(404).json({
//       message: "Product not found.",
//     });
//   }

//   const image = product.images.id(imageId);

//   if (!image) {
//     return res.status(404).json({
//       message: "Image not found.",
//     });
//   }

//   const publicId = image.publicId;

//   image.deleteOne();

//   if (
//     product.images.length &&
//     !product.images.some((i) => i.isPrimary)
//   ) {
//     product.images[0].isPrimary = true;
//   }

//   await product.save();

//   await deleteImage(publicId);

//   res.json({
//     message: "Product image deleted.",
//     product,
//   });
// });


const Product = require("../models/Product");
const asyncHandler = require("../middleware/asyncHandler");

const {
  sendNewProductLaunchEmails,
} = require("../utils/productLaunchEmail");

const {
  getPagination,
  paginated,
} = require("../utils/pagination");

const {
  uploadBuffer,
  deleteImage,
} = require("../utils/cloudinaryUpload");

const slugify = require("slugify");

// ============================================
// HELPER FUNCTIONS
// ============================================

const parseArray = (value) => {
  if (Array.isArray(value)) return value;

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
};

const bool = (value) =>
  value === true || value === "true" || value === "1";

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const makeUniqueSlug = async (name, excludeId) => {
  const base =
    slugify(name, {
      lower: true,
      strict: true,
      trim: true,
    }) || "product";

  let slug = base;
  let n = 1;

  while (
    await Product.exists({
      slug,
      ...(excludeId
        ? { _id: { $ne: excludeId } }
        : {}),
    })
  ) {
    slug = `${base}-${++n}`;
  }

  return slug;
};

// ============================================
// GET ALL PRODUCTS
// ============================================

exports.listProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};

  if (req.query.admin !== "true") {
    filter.isActive = true;
  }

  if (req.query.category) {
    filter.category = new RegExp(
      `^${escapeRegex(req.query.category)}$`,
      "i"
    );
  }

  if (req.query.featured !== undefined) {
    filter.isFeatured = req.query.featured === "true";
  }

  if (req.query.inStock === "true") {
    filter.stock = { $gt: 0 };
  }

  if (req.query.q) {
    filter.$text = {
      $search: String(req.query.q),
    };
  }

  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {
      ...(req.query.minPrice
        ? { $gte: Number(req.query.minPrice) }
        : {}),
      ...(req.query.maxPrice
        ? { $lte: Number(req.query.maxPrice) }
        : {}),
    };
  }

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    name: { name: 1 },
  };

  const sort = sortMap[req.query.sort] || {
    createdAt: -1,
  };

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit),

    Product.countDocuments(filter),
  ]);

  res.json(paginated(items, total, page, limit));
});

// ============================================
// GET SINGLE PRODUCT
// ============================================

exports.getProduct = asyncHandler(async (req, res) => {
  const key = req.params.slugOrId;

  const product = await Product.findOne({
    $or: [
      { slug: key },
      ...( /^[a-f\d]{24}$/i.test(key)
        ? [{ _id: key }]
        : []),
    ],
    ...(req.admin ? {} : { isActive: true }),
  });

  if (!product) {
    return res.status(404).json({
      message: "Product not found.",
    });
  }

  res.json({ product });
});

// ============================================
// CREATE PRODUCT + AUTOMATIC LAUNCH EMAIL
// ============================================

exports.createProduct = asyncHandler(async (req, res) => {
  const body = req.body;

  if (
    !body.name ||
    !body.sku ||
    body.price === undefined ||
    !body.category ||
    !body.description
  ) {
    return res.status(400).json({
      message:
        "name, sku, price, category and description are required.",
    });
  }

  const uploaded = [];

  try {
    // Upload images to Cloudinary
    for (const file of req.files || []) {
      uploaded.push(
        await uploadBuffer(file.buffer)
      );
    }

    let images = uploaded.map((im, i) => ({
      ...im,
      alt: body.imageAlt || body.name,
      isPrimary: i === 0,
    }));

    if (body.images) {
      const provided = parseArray(body.images).filter(
        (x) => x && x.url && x.publicId
      );

      images = [...images, ...provided];
    }

    const seoInput = body.seo
      ? typeof body.seo === "string"
        ? JSON.parse(body.seo)
        : body.seo
      : {};

    // Save product in MongoDB
    const product = await Product.create({
      name: body.name,

      slug: await makeUniqueSlug(
        body.slug || body.name
      ),

      sku: String(body.sku).toUpperCase(),

      shortDescription: body.shortDescription,
      description: body.description,
      content: body.content,

      ingredients: parseArray(body.ingredients),
      benefits: parseArray(body.benefits),

      howToUse: body.howToUse,
      warnings: body.warnings,

      category: body.category,
      brand: body.brand || "HOVIRA",

      price: Number(body.price),

      salePrice:
        body.salePrice === "" || body.salePrice == null
          ? null
          : Number(body.salePrice),

      costPrice:
        body.costPrice === "" || body.costPrice == null
          ? null
          : Number(body.costPrice),

      stock: Number(body.stock || 0),

      lowStockThreshold: Number(
        body.lowStockThreshold ?? 5
      ),

      currency:
        body.currency ||
        process.env.CURRENCY ||
        "INR",

      images,

      variants: parseArray(body.variants),
      tags: parseArray(body.tags),

      weightGrams: body.weightGrams
        ? Number(body.weightGrams)
        : null,

      isFeatured: bool(body.isFeatured),

      isActive:
        body.isActive === undefined
          ? true
          : bool(body.isActive),

      seo: seoInput,

      createdBy: req.admin?._id,

      // Newsletter tracking
      launchEmailStatus: "not_sent",

      launchEmailStats: {
        total: 0,
        sent: 0,
        failed: 0,
      },
    });

    // ========================================
    // AUTOMATIC PRODUCT LAUNCH EMAIL
    // ========================================

    let launchEmailStats = {
      total: 0,
      sent: 0,
      failed: 0,
    };

    if (product.isActive) {
      try {
        console.log(
          "[HOVIRA] Starting product launch emails:",
          product.name
        );

        launchEmailStats =
          await sendNewProductLaunchEmails(product);

        product.launchEmailStats = launchEmailStats;

        if (launchEmailStats.total === 0) {
          product.launchEmailStatus = "not_sent";
        } else if (launchEmailStats.failed === 0) {
          product.launchEmailStatus = "sent";
        } else if (launchEmailStats.sent > 0) {
          product.launchEmailStatus = "partial";
        } else {
          product.launchEmailStatus = "failed";
        }

        if (launchEmailStats.sent > 0) {
          product.launchEmailSentAt = new Date();
        }

        await product.save();

        console.log(
          "[HOVIRA] Product launch email result:",
          launchEmailStats
        );
      } catch (emailError) {
        console.error(
          "[HOVIRA] Product launch email failed:",
          emailError.message
        );

        product.launchEmailStatus = "failed";

        await product.save().catch((err) => {
          console.error(
            "Product email status save failed:",
            err.message
          );
        });
      }
    }

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(201).json({
      message: "Product created successfully.",
      product,
      launchEmailStats,
    });

  } catch (error) {
    // Delete uploaded Cloudinary images if product creation fails
    await Promise.all(
      uploaded.map((i) =>
        deleteImage(i.publicId).catch(() => null)
      )
    );

    throw error;
  }
});

// ============================================
// UPDATE PRODUCT
// ============================================

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      message: "Product not found.",
    });
  }

  const b = req.body;
  const uploaded = [];

  try {
    for (const file of req.files || []) {
      uploaded.push(
        await uploadBuffer(file.buffer)
      );
    }

    const allowed = [
      "name",
      "shortDescription",
      "description",
      "content",
      "howToUse",
      "warnings",
      "category",
      "brand",
      "currency",
    ];

    allowed.forEach((k) => {
      if (b[k] !== undefined) {
        product[k] = b[k];
      }
    });

    if (b.name && b.name !== product.name) {
      product.slug = await makeUniqueSlug(
        b.slug || b.name,
        product._id
      );
    } else if (b.slug) {
      product.slug = await makeUniqueSlug(
        b.slug,
        product._id
      );
    }

    if (b.sku !== undefined) {
      product.sku = String(b.sku).toUpperCase();
    }

    [
      "price",
      "stock",
      "lowStockThreshold",
      "weightGrams",
      "costPrice",
      "salePrice",
    ].forEach((k) => {
      if (b[k] !== undefined) {
        product[k] =
          b[k] === "" || b[k] === null
            ? null
            : Number(b[k]);
      }
    });

    [
      "ingredients",
      "benefits",
      "tags",
      "variants",
    ].forEach((k) => {
      if (b[k] !== undefined) {
        product[k] = parseArray(b[k]);
      }
    });

    [
      "isFeatured",
      "isActive",
    ].forEach((k) => {
      if (b[k] !== undefined) {
        product[k] = bool(b[k]);
      }
    });

    if (b.seo !== undefined) {
      product.seo =
        typeof b.seo === "string"
          ? JSON.parse(b.seo)
          : b.seo;
    }

    if (b.images !== undefined) {
      product.images = parseArray(b.images).filter(
        (x) => x && x.url && x.publicId
      );
    }

    uploaded.forEach((im, i) => {
      product.images.push({
        ...im,
        alt: b.imageAlt || product.name,
        isPrimary:
          product.images.length === 0 && i === 0,
      });
    });

    await product.save();

    res.json({
      message: "Product updated successfully.",
      product,
    });

  } catch (error) {
    await Promise.all(
      uploaded.map((i) =>
        deleteImage(i.publicId).catch(() => null)
      )
    );

    throw error;
  }
});

// ============================================
// DELETE PRODUCT
// ============================================

exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      message: "Product not found.",
    });
  }

  await product.deleteOne();

  await Promise.all(
    product.images.map((i) =>
      deleteImage(i.publicId).catch((err) =>
        console.error(
          "Cloudinary delete failed:",
          err.message
        )
      )
    )
  );

  res.json({
    message: "Product and associated Cloudinary images deleted.",
  });
});

// ============================================
// UPLOAD PRODUCT IMAGES
// ============================================

exports.uploadProductImages = asyncHandler(async (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({
      message: "Select at least one image.",
    });
  }

  const uploaded = [];

  try {
    for (const file of req.files) {
      uploaded.push(
        await uploadBuffer(file.buffer)
      );
    }

    res.status(201).json({
      message: "Images uploaded to Cloudinary.",
      images: uploaded,
    });

  } catch (e) {
    await Promise.all(
      uploaded.map((i) =>
        deleteImage(i.publicId).catch(() => null)
      )
    );

    throw e;
  }
});

// ============================================
// DELETE SINGLE PRODUCT IMAGE
// ============================================

exports.deleteProductImage = asyncHandler(async (req, res) => {
  const { imageId } = req.params;

  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      message: "Product not found.",
    });
  }

  const image = product.images.id(imageId);

  if (!image) {
    return res.status(404).json({
      message: "Image not found.",
    });
  }

  const publicId = image.publicId;

  image.deleteOne();

  if (
    product.images.length &&
    !product.images.some((i) => i.isPrimary)
  ) {
    product.images[0].isPrimary = true;
  }

  await product.save();

  await deleteImage(publicId);

  res.json({
    message: "Product image deleted.",
    product,
  });
});

// ============================================
// DELETE MULTIPLE PRODUCT IMAGES
// ============================================

exports.deleteMultipleProductImages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { imageIds } = req.body;

  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    return res.status(400).json({
      message: "Please select at least one image.",
    });
  }

  const uniqueImageIds = [
    ...new Set(imageIds.map((imageId) => String(imageId))),
  ];

  const product = await Product.findById(id);

  if (!product) {
    return res.status(404).json({
      message: "Product not found.",
    });
  }

  // Find selected image subdocuments
  const imagesToDelete = uniqueImageIds.map((imageId) =>
    product.images.id(imageId)
  );

  if (imagesToDelete.some((image) => !image)) {
    return res.status(404).json({
      message: "One or more selected images were not found.",
    });
  }

  // Delete images from Cloudinary
  const deletionResults = await Promise.allSettled(
    imagesToDelete.map((image) => {
      if (!image.publicId) {
        return Promise.reject(
          new Error(
            `Cloudinary publicId is missing for image ${image._id}.`
          )
        );
      }

      return deleteImage(image.publicId);
    })
  );

  const successfullyDeletedIds = [];
  const failedImageIds = [];

  deletionResults.forEach((result, index) => {
    const imageId = String(imagesToDelete[index]._id);

    if (result.status === "fulfilled") {
      successfullyDeletedIds.push(imageId);
    } else {
      failedImageIds.push(imageId);

      console.error(
        "Cloudinary image deletion failed:",
        imagesToDelete[index].publicId,
        result.reason?.message || result.reason
      );
    }
  });

  // Remove successfully deleted images from MongoDB
  if (successfullyDeletedIds.length > 0) {
    product.images = product.images.filter(
      (image) =>
        !successfullyDeletedIds.includes(String(image._id))
    );

    // Assign primary image automatically
    if (
      product.images.length > 0 &&
      !product.images.some((image) => image.isPrimary)
    ) {
      product.images[0].isPrimary = true;
    }

    await product.save();
  }

  return res.status(
    failedImageIds.length > 0 ? 207 : 200
  ).json({
    message:
      failedImageIds.length > 0
        ? `${successfullyDeletedIds.length} image(s) deleted; ${failedImageIds.length} image(s) could not be deleted.`
        : `${successfullyDeletedIds.length} image(s) deleted successfully.`,

    deletedCount: successfullyDeletedIds.length,
    failedCount: failedImageIds.length,
    failedImageIds,
    product,
  });
});