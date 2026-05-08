const mongoose = require("mongoose");

const blogCategorySchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 100 },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", maxlength: 300 },
    color:       { type: String, default: "#f97316" }, // accent color for display
  },
  { timestamps: true }
);

module.exports = mongoose.model("BlogCategory", blogCategorySchema);
