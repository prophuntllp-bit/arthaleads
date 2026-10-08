const express   = require("express");
const router    = express.Router();
const { protect } = require("../middlewares/auth");
const { planGate } = require("../middlewares/planGate");
const Invoice   = require("../models/Invoice");
const Booking   = require("../models/Booking");
const Developer = require("../models/Developer");

// Invoicing is the second half of the Growth booking engine.
router.use(protect, planGate("growth"));

// GET /api/invoices?status=&page=&limit=
// One page plus `summary` across ALL invoices, so the totals do not depend on how many are loaded.
router.get("/", async (req, res, next) => {
  try {
    const { status } = req.query;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const page = Math.max(1, Number(req.query.page) || 1);
    const filter = { orgId: req.user.orgId };
    if (status) filter.status = status;
    const [data, total, byStatus] = await Promise.all([
      Invoice.find(filter).sort({ invoiceNumber: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Invoice.countDocuments(filter),
      Invoice.aggregate([
        { $match: { orgId: req.user.orgId } },
        { $group: { _id: "$status", count: { $sum: 1 }, totalBill: { $sum: "$totalBill" } } },
      ]),
    ]);
    const summary = { count: 0, totalBill: 0, received: 0, pending: 0, byStatus: {} };
    for (const r of byStatus) {
      const t = r.totalBill || 0;
      summary.count += r.count; summary.totalBill += t;
      if (r._id === "payment_received") summary.received += t; else summary.pending += t;
      summary.byStatus[r._id] = { count: r.count, totalBill: t };
    }
    res.json({ success: true, data, total, page, limit, summary });
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

// PATCH /api/invoices/:id/number — set a custom invoice number override
router.patch("/:id/number", async (req, res, next) => {
  try {
    const { invoiceNumber } = req.body;
    const inv = await Invoice.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found." });
    inv.customInvoiceNumber = (invoiceNumber ?? "").toString().trim();
    await inv.save();
    res.json({ success: true, data: inv });
  } catch (e) { next(e); }
});

module.exports = router;
