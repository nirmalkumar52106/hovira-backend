
const express = require("express");
const router = express.Router();

const {
  createBlog,
  getBlogs,
  getAllBlogsAdmin,
  getBlogBySlug,
  getBlogById,
  updateBlog,
  deleteBlog,
  updateBlogStatus,
} = require("../controllers/blogController");

const { protectAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");

// ========================================
// PUBLIC BLOG APIs
// ========================================

// Get all published blogs
router.get("/", getBlogs);

// Find blog by SEO slug
router.get("/slug/:slug", getBlogBySlug);

// ========================================
// ADMIN BLOG APIs
// ========================================

// Get all blogs including drafts
router.get("/admin/all", protectAdmin, getAllBlogsAdmin);

// Create blog with Cloudinary image upload
router.post(
  "/",
  protectAdmin,
  upload.single("featuredImage"),
  createBlog
);

// Find blog by ID
router.get("/:id", protectAdmin, getBlogById);

// Update blog with optional new image
router.put(
  "/:id",
  protectAdmin,
  upload.single("featuredImage"),
  updateBlog
);

// Delete blog and its Cloudinary image
router.delete("/:id", protectAdmin, deleteBlog);

// Update blog status
router.patch("/:id/status", protectAdmin, updateBlogStatus);

module.exports = router;
