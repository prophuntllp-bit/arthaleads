// controllers/ticketController.js
const Ticket = require("../models/Ticket");
const { AppError } = require("../middlewares/errorHandler");

const ticketController = {
  // POST /api/tickets - raise a new support ticket
  async create(req, res, next) {
    try {
      const { subject, description, category, priority } = req.body;

      if (!subject?.trim()) return next(new AppError("Subject is required", 400));
      if (!description?.trim()) return next(new AppError("Description is required", 400));

      const ticket = await Ticket.create({
        orgId:       req.user.orgId,
        userId:      req.user._id,
        userName:    req.user.name,
        userEmail:   req.user.email,
        orgName:     req.org?.name || "Unknown",
        subject:     subject.trim().slice(0, 200),
        description: description.trim().slice(0, 3000),
        category:    category  || "general",
        priority:    priority  || "medium",
      });

      res.status(201).json({ success: true, ticket });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/tickets - list tickets for the current user's org
  async listMine(req, res, next) {
    try {
      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const skip  = (page - 1) * limit;

      const filter = { orgId: req.user.orgId };
      // Non-admins only see their own tickets
      if (req.user.role === "agent") filter.userId = req.user._id;

      const [tickets, total] = await Promise.all([
        Ticket.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select("-adminNotes") // hide internal notes from regular users
          .lean(),
        Ticket.countDocuments(filter),
      ]);

      res.json({ success: true, total, page, pages: Math.ceil(total / limit), tickets });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ticketController;
