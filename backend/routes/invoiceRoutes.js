const express   = require("express");
const router    = express.Router();
const { protect } = require("../middlewares/auth");
const Invoice   = require("../models/Invoice");
const Booking   = require("../models/Booking");
const Developer = require("../models/Developer");

router.use(protect);

// GET /api/invoices
router.get("/", async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { orgId: req.user.orgId };
    if (status) filter.status = status;
    const skip = (Math.max(1, Number(page)) - 1) * Math.min(50, Number(limit));
    const [data, total] = await Promise.all([
      Invoice.find(filter).sort({ invoiceNumber: -1 }).skip(skip).limit(Math.min(50, Number(limit))).lean(),
      Invoice.countDocuments(filter),
    ]);
    res.json({ success: true, data, total });
  } catch (e) { next(e); }
});

// POST /api/invoices  — generate invoice from a booking
router.post("/", async (req, res, next) => {
  try {
    const { bookingId, invoiceDate, notes } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, message: "Booking ID is required." });

    const booking = await Booking.findOne({ _id: bookingId, orgId: req.user.orgId });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

    const existing = await Invoice.findOne({ bookingId, orgId: req.user.orgId });
    if (existing) return res.status(409).json({ success: false, message: "Invoice already exists for this booking.", data: existing });

    const dev = await Developer.findById(booking.developerId).lean();

    const inv = await Invoice.create({
      orgId:     req.user.orgId,
      createdBy: req.user._id,
      bookingId,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      developerId:          booking.developerId,
      developerName:        dev?.name          || "",
      developerAddress:     dev?.address       || "",
      developerGst:         dev?.gstNo         || "",
      developerPan:         dev?.pan           || "",
      developerCin:         dev?.cin           || "",
      developerReraNumbers: dev?.reraNumbers   || [],
      customerName:        booking.customerName,
      jointBuyerName:      booking.jointBuyerName,
      projectName:         booking.projectName,
      phase:               booking.phase,
      unitType:            booking.unitType,
      unitNo:              booking.unitNo,
      tower:               booking.tower,
      bookingDate:         booking.bookingDate,
      considerationValue:  booking.considerationValue,
      brokeragePercent:    booking.brokeragePercent,
      brokerageAmount:     booking.brokerageAmount,
      brokerageAdjustment: booking.brokerageAdjustment,
      fosIncentive:        booking.fosIncentive,
      eoiIncentive:        booking.eoiIncentive,
      totalBrokerage:      booking.totalBrokerage,
      gstType:             booking.gstType,
      cgst:                booking.cgst,
      sgst:                booking.sgst,
      igst:                booking.igst,
      totalBill:           booking.totalBill,
      invoiceTemplate:     dev?.invoiceTemplate || "detailed",
      notes: notes?.trim() || "",
    });

    booking.status    = "invoiced";
    booking.invoiceId = inv._id;
    await booking.save();

    res.status(201).json({ success: true, data: inv });
  } catch (e) { next(e); }
});

// GET /api/invoices/:id
router.get("/:id", async (req, res, next) => {
  try {
    const data = await Invoice.findOne({ _id: req.params.id, orgId: req.user.orgId }).lean();
    if (!data) return res.status(404).json({ success: false, message: "Invoice not found." });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// PATCH /api/invoices/:id/status
router.patch("/:id/status", async (req, res, next) => {
  try {
    const VALID = ["draft", "sent", "payment_pending", "payment_received"];
    const { status } = req.body;
    if (!VALID.includes(status)) return res.status(400).json({ success: false, message: "Invalid status." });

    const inv = await Invoice.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found." });
    inv.status = status;
    if (status === "payment_received") {
      inv.paidAt = new Date();
    } else {
      inv.paidAt = undefined; // clear if reverting away from payment_received
    }
    await inv.save();

    // Sync booking status: payment_received ↔ invoiced
    const bookingStatus = status === "payment_received" ? "payment_received" : "invoiced";
    await Booking.findByIdAndUpdate(inv.bookingId, { status: bookingStatus });
    res.json({ success: true, data: inv });
  } catch (e) { next(e); }
});

module.exports = router;
