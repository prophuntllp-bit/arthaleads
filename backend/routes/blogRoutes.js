const express    = require("express");
const router     = express.Router();
const ctrl       = require("../controllers/blogController");
const { protect, authorize } = require("../middlewares/auth");

// ── Public routes ──────────────────────────────────────────────────────────────
router.get("/posts",            ctrl.getPosts);
router.get("/posts/:slug",      ctrl.getPost);
router.get("/categories",       ctrl.getCategories);

// ── Super admin only ───────────────────────────────────────────────────────────
const adminOnly = [protect, authorize("super_admin")];

router.get   ("/admin/posts",           ...adminOnly, ctrl.adminGetPosts);
router.get   ("/admin/posts/:id",       ...adminOnly, ctrl.adminGetPost);
router.post  ("/admin/posts",           ...adminOnly, ctrl.createPost);
router.put   ("/admin/posts/:id",       ...adminOnly, ctrl.updatePost);
router.delete("/admin/posts/:id",       ...adminOnly, ctrl.deletePost);
router.post  ("/admin/upload-image",    ...adminOnly, ctrl.uploadImage);
router.post  ("/admin/categories",      ...adminOnly, ctrl.createCategory);
router.delete("/admin/categories/:id",  ...adminOnly, ctrl.deleteCategory);

module.exports = router;
