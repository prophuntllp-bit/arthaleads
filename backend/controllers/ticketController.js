// controllers/ticketController.js
const Ticket = require("../models/Ticket");
const { AppError } = require("../middlewares/errorHandler");

const MAX_ATTACHMENTS = 3;
const MAX_ATTACH_BYTES = 600 * 1024; // 600 KB per file (pre-base64)

function sanitiseAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_ATTACHMENTS).map((a) => ({
    url:  String(a.url  || "").slice(0, 2_000_000), // ~1.5 MB base64 cap
    name: String(a.name || "attachment").slice(0, 200),
    size: Number(a.size || 0),
  })).filter((a) => a.url);
}

const ticketController = {
  // POST /api/tickets - raise a new support ticket
  async create(req, res, next) {
    try {
      const { subject, description, category, priority, attachments } = req.body;

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
        attachments: sanitiseAttachments(attachments),
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
          .select("-adminNotes -attachments -replies.attachments") // strip heavy fields from list
          .lean(),
        Ticket.countDocuments(filter),
      ]);

      res.json({ success: true, total, page, pages: Math.ceil(total / limit), tickets });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/tickets/:id - get a single ticket with full thread
  async getOne(req, res, next) {
    try {
      const filter = { _id: req.params.id, orgId: req.user.orgId };
      if (req.user.role === "agent") filter.userId = req.user._id;

      const ticket = await Ticket.findOne(filter).select("-adminNotes").lean();
      if (!ticket) return next(new AppError("Ticket not found", 404));

      res.json({ success: true, ticket });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/tickets/:id/reply - user adds a reply
  async addReply(req, res, next) {
    try {
      const { body, attachments } = req.body;
      if (!body?.trim()) return next(new AppError("Reply body is required", 400));

      const filter = { _id: req.params.id, orgId: req.user.orgId };
      if (req.user.role === "agent") filter.userId = req.user._id;

      const ticket = await Ticket.findOne(filter);
      if (!ticket) return next(new AppError("Ticket not found", 404));
      if (ticket.status === "closed") return next(new AppError("Cannot reply to a closed ticket", 400));

      ticket.replies.push({
        body:        body.trim().slice(0, 3000),
        authorId:    req.user._id,
        authorName:  req.user.name,
        isAdmin:     false,
        attachments: sanitiseAttachments(attachments),
        createdAt:   new Date(),
      });

      // Re-open if admin had resolved it and user is following up
      if (ticket.status === "resolved") ticket.status = "open";

      await ticket.save();
      res.json({ success: true, ticket });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ticketController;
