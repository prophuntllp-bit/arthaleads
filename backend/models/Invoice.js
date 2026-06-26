const mongoose = require("mongoose");
const Counter  = require("./Counter");
const OID = mongoose.Schema.Types.ObjectId;

const invoiceSchema = new mongoose.Schema(
  {
    orgId:     { type: OID, ref: "Organization", required: true, index: true },
    createdBy: { type: OID, ref: "User" },
    bookingId: { type: OID, ref: "Booking", required: true },

    invoiceNumber:       { type: Number, index: true },
    customInvoiceNumber: { type: String, trim: true, default: "" },
    invoiceDate:         { type: Date, default: Date.now },

    // Developer snapshot at time of generation
    developerId:          { type: OID, ref: "Developer" },
    developerName:        { type: String, trim: true, default: "" },
    developerAddress:     { type: String, trim: true, default: "" },
    developerGst:         { type: String, trim: true, default: "" },
    developerPan:         { type: String, trim: true, default: "" },
    developerCin:         { type: String, trim: true, default: "" },
    developerReraNumbers: [{ type: String }],

    // Booking snapshot
    customerName:        { type: String, trim: true, default: "" },
    jointBuyerName:      { type: String, trim: true, default: "" },
    projectName:         { type: String, trim: true, default: "" },
    phase:               { type: String, trim: true, default: "" },
    unitType:            { type: String, trim: true, default: "" },
    unitNo:              { type: String, trim: true, default: "" },
    tower:               { type: String, trim: true, default: "" },
    bookingDate:         { type: Date },
    considerationValue:  { type: Number, default: 0 },
    brokeragePercent:    { type: Number, default: 0 },
    brokerageAmount:     { type: Number, default: 0 },
    brokerageAdjustment: { type: Number, default: 0 },
    fosIncentive:        { type: Number, default: 0 },
    eoiIncentive:        { type: Number, default: 0 },
    totalBrokerage:      { type: Number, default: 0 },
    gstType:             { type: String, default: "CGST_SGST" },
    cgst:                { type: Number, default: 0 },
    sgst:                { type: Number, default: 0 },
    igst:                { type: Number, default: 0 },
    totalBill:           { type: Number, default: 0 },

    invoiceTemplate: { type: String, enum: ["simple", "detailed"], default: "detailed" },
    status: { type: String, enum: ["draft", "sent", "payment_pending", "payment_received"], default: "draft" },
    paidAt: { type: Date, default: null },
    notes:  { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

// Auto-generate sequential invoice number per org
invoiceSchema.pre("save", async function (next) {
  if (this.invoiceNumber) return next();
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: `invoice_${this.orgId}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.invoiceNumber = counter.seq;
    next();
  } catch (err) { next(err); }
});

invoiceSchema.index({ orgId: 1, invoiceNumber: -1 });
module.exports = mongoose.model("Invoice", invoiceSchema);
