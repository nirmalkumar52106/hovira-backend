
const Blog = require("../models/Blog");
const sanitizeHtml = require("sanitize-html");
const {
  uploadBuffer,
  deleteImage,
} = require("../utils/cloudinaryUpload");

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// Generate SEO-friendly slug
const generateSlug = (text = "") => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

// Generate unique slug
const createUniqueSlug = async (title, currentId = null) => {
  const baseSlug = generateSlug(title);

  if (!baseSlug) {
    throw new Error("Unable to generate blog slug");
  }

  let slug = baseSlug;
  let count = 1;

  while (true) {
    const existingBlog = await Blog.findOne({
      slug,
      ...(currentId ? { _id: { $ne: currentId } } : {}),
    }).select("_id");

    if (!existingBlog) break;

    slug = `${baseSlug}-${count}`;
    count++;
  }

  return slug;
};

// Sanitize HTML content
const cleanContent = (html = "") => {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "h3",
      "h4",
      "figure",
      "figcaption",
      "iframe",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "span",
      "div",
      "section",
      "hr",
      "del",
      "ins",
      "sup",
      "sub",
    ]),

    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,

      "*": ["class", "id", "style"],

      img: [
        "src",
        "alt",
        "title",
        "width",
        "height",
        "loading",
      ],

      a: [
        "href",
        "name",
        "target",
        "rel",
      ],

      iframe: [
        "src",
        "width",
        "height",
        "allow",
        "allowfullscreen",
        "title",
      ],

      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },

    allowedSchemes: ["http", "https", "mailto"],

    allowedIframeHostnames: [
      "www.youtube.com",
      "youtube.com",
      "www.youtube-nocookie.com",
    ],
  });
};

// Parse array fields from JSON or FormData
const parseArray = (value) => {
  if (Array.isArray(value)) return value;

  if (!value) return [];

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

// Parse boolean fields from FormData
const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return value === true || value === "true";
};

// Calculate reading time
const calculateReadTime = (content = "") => {
  const plainText = content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = plainText
    ? plainText.split(" ").filter(Boolean).length
    : 0;

  return Math.max(1, Math.ceil(words / 200));
};

// Normalize featured image
const getFeaturedImage = (image) => ({
  url: image?.url || "",
  publicId: image?.publicId || "",
  alt: image?.alt || "",
});

// Delete Cloudinary image safely
const removeCloudinaryImage = async (publicId) => {
  if (!publicId) return;

  try {
    await deleteImage(publicId);
  } catch (error) {
    console.error("Cloudinary Delete Error:", error.message);
  }
};

// =====================================================
// 1. CREATE BLOG
// POST /api/blogs
// =====================================================

exports.createBlog = async (req, res) => {
  let uploadedImage = null;

  try {
    const {
      title,
      excerpt,
      content,
      category,
      tags,
      author,
      status,
      isFeatured,
      metaTitle,
      metaDescription,
      keywords,
      canonicalUrl,
      ogTitle,
      ogDescription,
      ogImage,
      noIndex,
      faqs,
      imageAlt,
    } = req.body;

    if (!title || !excerpt || !content) {
      return res.status(400).json({
        success: false,
        message: "Title, excerpt and content are required",
      });
    }

    const safeContent = cleanContent(content);

    if (!safeContent.trim()) {
      return res.status(400).json({
        success: false,
        message: "Blog content is empty or invalid after sanitization",
      });
    }

    // Generate unique slug
    const slug = await createUniqueSlug(title);

    // Upload featured image to Cloudinary
    if (req.file) {
      uploadedImage = await uploadBuffer(
        req.file.buffer,
        "hovira/blogs"
      );
    }

    const blogStatus =
      status === "published" ? "published" : "draft";

    const blog = await Blog.create({
      title: title.trim(),
      slug,
      excerpt,
      content: safeContent,

      category: category || "General",
      tags: parseArray(tags),
      author: author || "HOVIRA",

      status: blogStatus,
      isFeatured: parseBoolean(isFeatured),

      featuredImage: {
        url: uploadedImage?.url || "",
        publicId: uploadedImage?.publicId || "",
        alt: imageAlt || title,
      },

      // SEO fields
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || excerpt,
      keywords: parseArray(keywords),
      canonicalUrl: canonicalUrl || "",

      ogTitle: ogTitle || metaTitle || title,
      ogDescription: ogDescription || metaDescription || excerpt,
      ogImage: uploadedImage?.url || ogImage || "",

      noIndex: parseBoolean(noIndex),

      // FAQ schema data
      faqs: parseArray(faqs),

      readTime: calculateReadTime(safeContent),

      publishedAt:
        blogStatus === "published" ? new Date() : null,
    });

    return res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog,
    });
  } catch (error) {
    // Remove uploaded image if blog creation fails
    if (uploadedImage?.publicId) {
      await removeCloudinaryImage(uploadedImage.publicId);
    }

    console.error("Create Blog Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create blog",
      error: error.message,
    });
  }
};

// =====================================================
// 2. GET ALL PUBLISHED BLOGS
// GET /api/blogs
// =====================================================

exports.getBlogs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);

    const limit = Math.min(
      50,
      Math.max(1, Number(req.query.limit) || 10)
    );

    const skip = (page - 1) * limit;

    const {
      category,
      tag,
      search,
      featured,
    } = req.query;

    const filter = {
      status: "published",
    };

    if (category) {
      filter.category = category;
    }

    if (tag) {
      filter.tags = tag;
    }

    if (featured === "true") {
      filter.isFeatured = true;
    }

    if (search) {
      const safeSearch = search
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .slice(0, 100);

      filter.$or = [
        {
          title: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          excerpt: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          tags: {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .select("-content")
        .sort({
          publishedAt: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Blog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      blogs,

      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get Blogs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
      error: error.message,
    });
  }
};

// =====================================================
// 3. GET ALL BLOGS FOR ADMIN
// GET /api/blogs/admin/all
// =====================================================

exports.getAllBlogsAdmin = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);

    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 20)
    );

    const skip = (page - 1) * limit;

    const [blogs, total] = await Promise.all([
      Blog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Blog.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      blogs,

      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin Blogs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin blogs",
      error: error.message,
    });
  }
};

// =====================================================
// 4. FIND BLOG BY SEO SLUG
// GET /api/blogs/slug/:slug
// =====================================================

exports.getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({
      slug: req.params.slug,
      status: "published",
    });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Increment blog views
    await Blog.updateOne(
      { _id: blog._id },
      { $inc: { views: 1 } }
    );

    // Return updated view count in response
    blog.views += 1;

    return res.status(200).json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error("Get Blog By Slug Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog detail",
      error: error.message,
    });
  }
};

// =====================================================
// 5. FIND BLOG BY ID - ADMIN
// GET /api/blogs/:id
// =====================================================

exports.getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.status(200).json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error("Get Blog By ID Error:", error);

    return res.status(400).json({
      success: false,
      message: "Invalid blog ID",
      error: error.message,
    });
  }
};

// =====================================================
// 6. UPDATE BLOG WITH CLOUDINARY IMAGE
// PUT /api/blogs/:id
// =====================================================

exports.updateBlog = async (req, res) => {
  let uploadedImage = null;

  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const data = { ...req.body };

    // Generate new slug if title changes
    if (data.title && data.title !== blog.title) {
      data.slug = await createUniqueSlug(
        data.title,
        blog._id
      );
    }

    // Sanitize HTML content
    if (data.content !== undefined) {
      data.content = cleanContent(data.content);

      if (!data.content.trim()) {
        return res.status(400).json({
          success: false,
          message: "Blog content is empty or invalid",
        });
      }

      data.readTime = calculateReadTime(data.content);
    }

    // Parse array fields
    if (data.tags !== undefined) {
      data.tags = parseArray(data.tags);
    }

    if (data.keywords !== undefined) {
      data.keywords = parseArray(data.keywords);
    }

    if (data.faqs !== undefined) {
      data.faqs = parseArray(data.faqs);
    }

    // Parse boolean fields
    if (data.isFeatured !== undefined) {
      data.isFeatured = parseBoolean(data.isFeatured);
    }

    if (data.noIndex !== undefined) {
      data.noIndex = parseBoolean(data.noIndex);
    }

    // Handle publish status
    if (data.status !== undefined) {
      if (!["draft", "published"].includes(data.status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be draft or published",
        });
      }

      if (data.status === "published" && !blog.publishedAt) {
        data.publishedAt = new Date();
      }

      if (data.status === "draft") {
        data.publishedAt = null;
      }
    }

    // Prevent updating protected/internal fields
    delete data._id;
    delete data.views;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.__v;
    delete data.featuredImage;

    const oldPublicId = blog.featuredImage?.publicId;

    // Upload new image if provided
    if (req.file) {
      uploadedImage = await uploadBuffer(
        req.file.buffer,
        "hovira/blogs"
      );

      data.featuredImage = {
        url: uploadedImage.url,
        publicId: uploadedImage.publicId,
        alt: req.body.imageAlt || data.title || blog.title,
      };

      // Update OG image when featured image changes
      data.ogImage = uploadedImage.url;
    } else if (req.body.imageAlt !== undefined) {
      // Update only alt text without replacing image
      data.featuredImage = {
        ...getFeaturedImage(blog.featuredImage),
        alt: req.body.imageAlt,
      };
    }

    // Apply updates
    Object.assign(blog, data);

    // Save database first
    const updatedBlog = await blog.save();

    // Delete previous image only after successful save
    if (
      uploadedImage?.publicId &&
      oldPublicId &&
      oldPublicId !== uploadedImage.publicId
    ) {
      await removeCloudinaryImage(oldPublicId);
    }

    return res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      blog: updatedBlog,
    });
  } catch (error) {
    // Remove new upload if database update fails
    if (uploadedImage?.publicId) {
      await removeCloudinaryImage(uploadedImage.publicId);
    }

    console.error("Update Blog Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update blog",
      error: error.message,
    });
  }
};

// =====================================================
// 7. DELETE BLOG AND CLOUDINARY IMAGE
// DELETE /api/blogs/:id
// =====================================================

exports.deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const imagePublicId = blog.featuredImage?.publicId;

    // Delete blog from MongoDB
    await Blog.findByIdAndDelete(req.params.id);

    // Delete featured image from Cloudinary
    if (imagePublicId) {
      await removeCloudinaryImage(imagePublicId);
    }

    return res.status(200).json({
      success: true,
      message: "Blog and its Cloudinary image deleted successfully",
    });
  } catch (error) {
    console.error("Delete Blog Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete blog",
      error: error.message,
    });
  }
};

// =====================================================
// 8. UPDATE BLOG STATUS
// PATCH /api/blogs/:id/status
// =====================================================

exports.updateBlogStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["draft", "published"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be draft or published",
      });
    }

    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    blog.status = status;

    if (status === "published") {
      blog.publishedAt = blog.publishedAt || new Date();
    } else {
      blog.publishedAt = null;
    }

    await blog.save();

    return res.status(200).json({
      success: true,
      message: `Blog ${status} successfully`,
      blog,
    });
  } catch (error) {
    console.error("Update Blog Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update blog status",
      error: error.message,
    });
  }
};
