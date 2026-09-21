// models/Project.js
const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [120, "Name too long"],
    },
    description: { type: String, trim: true, default: "" },
    location:    { type: String, trim: true, default: "" },
    images:      [{ type: String, trim: true }], // array of URLs
    brochureUrl: { type: String, trim: true, default: "" }, // single PDF URL — sent by the WhatsApp AI agent when its Share Brochure permission is on
    floorPlanUrl: { type: String, trim: true, default: "" }, // single PDF URL — sent with "Floor Plan & Brochure" / when the customer asks for the floor plan
    // WhatsApp-ready MP4s (<=10MB, see utils/videoCompress.js). Added and
    // removed only through the /videos endpoints, never through the project form.
    videos: [{ _id: false, url: { type: String, trim: true }, sizeBytes: Number, durationSec: Number }],

    // Pricing & config
    propertyType:    { type: String, trim: true, default: "Apartment" },
    unitTypes:       [{ type: String, trim: true }], // generic configurations: BHKs, plot sizes/types, villa/commercial unit types
    priceMin:       { type: Number, default: 0 },
    priceMax:       { type: Number, default: 0 },
    bhkTypes:       [{ type: String, trim: true }], // ["2BHK","3BHK"]
    area:           { type: String, trim: true, default: "" }, // "1200–1800 sq ft"
    amenities:      [{ type: String, trim: true }],
    possessionDate: { type: Date, default: null },
    reraNumber:     { type: String, trim: true, default: "" },

    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // The one person a WhatsApp AI agent hands a lead to for this specific
    // project when its "Talk to Advisor" CTWA button is tapped — separate
    // from assignedTo above (who sees the project/leads in the CRM), because
    // a tenant with several projects often wants a different point-of-contact
    // per project, not just whoever the lead happens to be round-robined to.
    advisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    qrToken:    { type: String, default: "", index: true, sparse: true },

    isArchived: { type: Boolean, default: false },
    orgId:      { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

projectSchema.index({ createdAt: -1 });
projectSchema.index({ createdBy: 1 });
// Note: orgId compound index is defined on the field itself (index: true) - no duplicate needed here

module.exports = mongoose.model("Project", projectSchema);
