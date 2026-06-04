const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;

const developerSchema = new mongoose.Schema(
  {
    orgId:     { type: OID, ref: "Organization", required: true, index: true },
    createdBy: { type: OID, ref: "User" },
    name:      { type: String, required: true, trim: true, maxlength: 200 },
    address:   { type: String, trim: true, default: "" },
    pan:       { type: String, trim: true, default: "" },
    cin:       { type: String, trim: true, default: "" },
    gstNo:     { type: String, trim: true, default: "" },
    reraNumbers: [{ type: String, trim: true }],
    defaultBrokeragePercent: { type: Number, default: 2,  min: 0, max: 100 },
    defaultFosIncentive:     { type: Number, default: 0,  min: 0 },
    defaultEoiIncentive:     { type: Number, default: 0,  min: 0 },
    invoiceTemplate: { type: String, enum: ["simple", "detailed"], default: "detailed" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

developerSchema.index({ orgId: 1, name: 1 });
module.exports = mongoose.model("Developer", developerSchema);
