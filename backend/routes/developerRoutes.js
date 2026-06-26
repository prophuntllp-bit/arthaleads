const express   = require("express");
const router    = express.Router();
const { protect } = require("../middlewares/auth");
const Developer = require("../models/Developer");

router.use(protect);

// GET /api/developers
router.get("/", async (req, res, next) => {
  try {
    const devs = await Developer.find({ orgId: req.user.orgId, isActive: { $ne: false } })
      .sort({ name: 1 }).lean();
    res.json({ success: true, data: devs });
  } catch (e) { next(e); }
});

// POST /api/developers
router.post("/", async (req, res, next) => {
  try {
    const { name, address, pan, cin, gstNo, reraNumbers,
            defaultBrokeragePercent, defaultFosIncentive, defaultEoiIncentive, invoiceTemplate } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Developer name is required." });
    const dev = await Developer.create({
      orgId:     req.user.orgId,
      createdBy: req.user._id,
      name:      name.trim(),
      address:   address?.trim() || "",
      pan:       pan?.trim()   || "",
      cin:       cin?.trim()   || "",
      gstNo:     gstNo?.trim() || "",
      reraNumbers: Array.isArray(reraNumbers) ? reraNumbers.filter(Boolean).map(r => String(r).trim()) : [],
      defaultBrokeragePercent: Number(defaultBrokeragePercent) || 2,
      defaultFosIncentive:     Number(defaultFosIncentive)     || 0,
      defaultEoiIncentive:     Number(defaultEoiIncentive)     || 0,
      invoiceTemplate: invoiceTemplate || "detailed",
    });
    res.status(201).json({ success: true, data: dev });
  } catch (e) { next(e); }
});

// PUT /api/developers/:id
router.put("/:id", async (req, res, next) => {
  try {
    const dev = await Developer.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!dev) return res.status(404).json({ success: false, message: "Developer not found." });

    const { name, address, pan, cin, gstNo, reraNumbers,
            defaultBrokeragePercent, defaultFosIncentive, defaultEoiIncentive, invoiceTemplate } = req.body;
    if (name?.trim()) dev.name = name.trim();
    if (address   !== undefined) dev.address   = address?.trim()  || "";
    if (pan       !== undefined) dev.pan       = pan?.trim()      || "";
    if (cin       !== undefined) dev.cin       = cin?.trim()      || "";
    if (gstNo     !== undefined) dev.gstNo     = gstNo?.trim()    || "";
    if (Array.isArray(reraNumbers)) dev.reraNumbers = reraNumbers.filter(Boolean).map(r => String(r).trim());
    if (defaultBrokeragePercent !== undefined) dev.defaultBrokeragePercent = Number(defaultBrokeragePercent) || 2;
    if (defaultFosIncentive     !== undefined) dev.defaultFosIncentive     = Number(defaultFosIncentive)     || 0;
    if (defaultEoiIncentive     !== undefined) dev.defaultEoiIncentive     = Number(defaultEoiIncentive)     || 0;
    if (invoiceTemplate) dev.invoiceTemplate = invoiceTemplate;
    await dev.save();
    res.json({ success: true, data: dev });
  } catch (e) { next(e); }
});

// DELETE /api/developers/:id  (soft-delete)
router.delete("/:id", async (req, res, next) => {
  try {
    const dev = await Developer.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!dev) return res.status(404).json({ success: false, message: "Developer not found." });
    dev.isActive = false;
    await dev.save();
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
