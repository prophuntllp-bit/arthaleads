const express   = require("express");
const router    = express.Router();
const { protect } = require("../middlewares/auth");
const Booking   = require("../models/Booking");
const Developer = require("../models/Developer");

router.use(protect);

function calcFinancials({ considerationValue, brokeragePercent, brokerageAmount,
                          brokerageAdjustment, fosIncentive, eoiIncentive, gstType }) {
  const cv  = Number(considerationValue)  || 0;
  const pct = Number(brokeragePercent)    || 0;
  const brok = brokerageAmount !== undefined && brokerageAmount !== null
    ? Number(brokerageAmount)
    : Math.round(cv * pct / 100 * 100) / 100;
  const adj = Number(brokerageAdjustment) || 0;
  const fos = Number(fosIncentive)        || 0;
  const eoi = Number(eoiIncentive)        || 0;
  const total = Math.round((brok - adj + fos + eoi) * 100) / 100;
  const gt = gstType || "CGST_SGST";
  let cgst = 0, sgst = 0, igst = 0;
  if (gt === "IGST") {
    igst = Math.round(total * 0.18 * 100) / 100;
  } else {
    cgst = Math.round(total * 0.09 * 100) / 100;
    sgst = cgst;
  }
  const totalBill = Math.round((total + cgst + sgst + igst) * 100) / 100;
  return { brokerageAmount: brok, brokerageAdjustment: adj, fosIncentive: fos,
           eoiIncentive: eoi, totalBrokerage: total, gstType: gt, cgst, sgst, igst, totalBill };
}

// GET /api/bookings
router.get("/", async (req, res, next) => {
  try {
    const { status, developerId, page = 1, limit = 20 } = req.query;
    const filter = { orgId: req.user.orgId };
    if (status)      filter.status      = status;
    if (developerId) filter.developerId = developerId;
    const skip = (Math.max(1, Number(page)) - 1) * Math.min(50, Number(limit));
    const [data, total] = await Promise.all([
      Booking.find(filter)
        .populate("developerId", "name gstNo")
        .sort({ createdAt: -1 })
        .skip(skip).limit(Math.min(50, Number(limit)))
        .lean(),
      Booking.countDocuments(filter),
    ]);
    res.json({ success: true, data, total });
  } catch (e) { next(e); }
});

// POST /api/bookings
router.post("/", async (req, res, next) => {
  try {
    const { customerName, jointBuyerName, projectName, phase, unitType, unitNo, tower,
            bookingDate, considerationValue, brokeragePercent, brokerageAmount,
            brokerageAdjustment, fosIncentive, eoiIncentive, gstType, developerId, leadId, notes } = req.body;

    if (!customerName?.trim()) return res.status(400).json({ success: false, message: "Customer name is required." });
    if (!projectName?.trim())  return res.status(400).json({ success: false, message: "Project name is required." });
    if (!unitNo?.trim())       return res.status(400).json({ success: false, message: "Unit / Plot number is required." });
    if (!developerId)          return res.status(400).json({ success: false, message: "Developer is required." });

    const dev = await Developer.findOne({ _id: developerId, orgId: req.user.orgId });
    if (!dev) return res.status(404).json({ success: false, message: "Developer not found." });

    const calc = calcFinancials({ considerationValue, brokeragePercent, brokerageAmount,
                                   brokerageAdjustment, fosIncentive, eoiIncentive, gstType });
    const booking = await Booking.create({
      orgId: req.user.orgId, createdBy: req.user._id,
      leadId: leadId || null, developerId,
      customerName: customerName.trim(),
      jointBuyerName: jointBuyerName?.trim() || "",
      projectName: projectName.trim(),
      phase: phase?.trim() || "",
      unitType: unitType || "Flat",
      unitNo: unitNo.trim(),
      tower: tower?.trim() || "",
      bookingDate: bookingDate ? new Date(bookingDate) : new Date(),
      considerationValue: Number(considerationValue) || 0,
      brokeragePercent:   Number(brokeragePercent)   || 0,
      notes: notes?.trim() || "",
      ...calc,
    });
    res.status(201).json({ success: true, data: booking });
  } catch (e) { next(e); }
});

// GET /api/bookings/:id
router.get("/:id", async (req, res, next) => {
  try {
    const data = await Booking.findOne({ _id: req.params.id, orgId: req.user.orgId })
      .populate("developerId").lean();
    if (!data) return res.status(404).json({ success: false, message: "Booking not found." });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// PUT /api/bookings/:id
router.put("/:id", async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

    ["customerName", "jointBuyerName", "projectName", "phase",
     "unitType", "unitNo", "tower", "notes", "status"].forEach(f => {
      if (req.body[f] !== undefined) booking[f] = req.body[f];
    });
    if (req.body.bookingDate)         booking.bookingDate = new Date(req.body.bookingDate);
    if (req.body.considerationValue  !== undefined) booking.considerationValue  = Number(req.body.considerationValue)  || 0;
    if (req.body.brokeragePercent    !== undefined) booking.brokeragePercent    = Number(req.body.brokeragePercent)    || 0;

    const calc = calcFinancials({
      considerationValue:  booking.considerationValue,
      brokeragePercent:    booking.brokeragePercent,
      brokerageAmount:     req.body.brokerageAmount     !== undefined ? req.body.brokerageAmount     : booking.brokerageAmount,
      brokerageAdjustment: req.body.brokerageAdjustment !== undefined ? req.body.brokerageAdjustment : booking.brokerageAdjustment,
      fosIncentive:        req.body.fosIncentive        !== undefined ? req.body.fosIncentive        : booking.fosIncentive,
      eoiIncentive:        req.body.eoiIncentive        !== undefined ? req.body.eoiIncentive        : booking.eoiIncentive,
      gstType:             req.body.gstType || booking.gstType,
    });
    Object.assign(booking, calc);
    await booking.save();
    res.json({ success: true, data: booking });
  } catch (e) { next(e); }
});

// DELETE /api/bookings/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const b = await Booking.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!b) return res.status(404).json({ success: false, message: "Booking not found." });
    if (b.invoiceId) return res.status(400).json({ success: false, message: "Cannot delete a booking that has an invoice." });
    await b.deleteOne();
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
