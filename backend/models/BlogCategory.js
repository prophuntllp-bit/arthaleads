const mongoose = require("mongoose");

const blogCategorySchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 100 },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", maxlength: 300 },
    color:       { type: String, default: "#f97316" }, // accent color for display
    // The topic's page, /blog/category/<slug>. Filled from config/blogCategories.js
    // by services/sanityBlogSync.js; `order` is the order of the blog's topic tabs.
    seoTitle:    { type: String, default: "", maxlength: 70 },
    intro:       { type: String, default: "", maxlength: 600 },
    order:       { type: Number, default: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BlogCategory", blogCategorySchema);
