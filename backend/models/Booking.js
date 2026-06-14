const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;

const bookingSchema = new mongoose.Schema(
  {
    orgId:     { type: OID, ref: "Organization", required: true, index: true },
    createdBy: { type: OID, ref: "User" },
    leadId:    { type: OID, ref: "Lead", default: null },
    developerId: { type: OID, ref: "Developer", required: true },

    // Customer
    customerName:   { type: String, required: true, trim: true },
    jointBuyerName: { type: String, trim: true, default: "" },

    // Unit
    projectName: { type: String, required: true, trim: true },
    phase:       { type: String, trim: true, default: "" },
    unitType:    { type: String, enum: ["Flat", "Plot", "Villa", "Shop", "Office", "Other"], default: "Flat" },
    unitNo:      { type: String, required: true, trim: true },
    tower:       { type: String, trim: true, default: "" },
    bookingDate: { type: Date, default: Date.now },

    // Financials
    considerationValue:   { type: Number, default: 0, min: 0 },
    brokeragePercent:     { type: Number, default: 2, min: 0 },
    brokerageAmount:      { type: Number, default: 0, min: 0 },
    brokerageAdjustment:  { type: Number, default: 0 },
    fosIncentive:         { type: Number, default: 0, min: 0 },
    eoiIncentive:         { type: Number, default: 0, min: 0 },
    totalBrokerage:       { type: Number, default: 0 },
    gstType:              { type: String, enum: ["CGST_SGST", "IGST"], default: "CGST_SGST" },
    cgst:                 { type: Number, default: 0 },
    sgst:                 { type: Number, default: 0 },
    igst:                 { type: Number, default: 0 },
    totalBill:            { type: Number, default: 0 },

    status:    { type: String, enum: ["new", "invoiced", "payment_received"], default: "new" },
    notes:     { type: String, trim: true, default: "" },
    invoiceId: { type: OID, ref: "Invoice", default: null },
  },
  { timestamps: true }
);

bookingSchema.index({ orgId: 1, createdAt: -1 });
bookingSchema.index({ orgId: 1, status: 1 });
module.exports = mongoose.model("Booking", bookingSchema);
