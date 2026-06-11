const Task = require("../models/Task");

const taskController = {
  // GET /api/tasks  — all roles; agents see only tasks assigned to them
  async list(req, res, next) {
    try {
      const { status, priority, assignedTo, projectId, from, to, myOnly } = req.query;
      const user = req.user;

      const filter = { orgId: user.orgId };

      // Agents can only see their own tasks
      if (user.role === "agent" || myOnly === "true") {
        filter.assignedTo = user._id;
      } else if (assignedTo) {
        filter.assignedTo = assignedTo;
      }

      if (status)    filter.status   = status;
      if (priority)  filter.priority = priority;
      if (projectId) filter.project  = projectId;

      if (from || to) {
        filter.dueDate = {};
        if (from) filter.dueDate.$gte = new Date(from);
        if (to)   filter.dueDate.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
      }

      const tasks = await Task.find(filter).sort({ dueDate: 1 }).lean();

      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

      const summary = { today: 0, upcoming: 0, overdue: 0, completed: 0, all: tasks.length };

      for (const t of tasks) {
        if (t.status === "completed") { summary.completed++; continue; }
        const due = new Date(t.dueDate);
        if (due < todayStart)       summary.overdue++;
        else if (due <= todayEnd)   summary.today++;
        else                        summary.upcoming++;
      }

      res.json({ success: true, tasks, summary });
    } catch (err) { next(err); }
  },

  // POST /api/tasks  — admin/manager only
  async create(req, res, next) {
    try {
      const { title, description, priority, dueDate, assignedTo, assignedToName, lead, leadName, project, projectName } = req.body;
      const user = req.user;

      const task = await Task.create({
        orgId:          user.orgId,
        title,
        description,
        priority,
        dueDate,
        assignedTo,
        assignedToName: assignedToName || "",
        assignedBy:     user._id,
        assignedByName: user.name,
        lead:           lead    || null,
        leadName:       leadName    || "",
        project:        project || null,
        projectName:    projectName || "",
      });

      res.status(201).json({ success: true, task });
    } catch (err) { next(err); }
  },

  // PATCH /api/tasks/:id  — admin/manager only
  async update(req, res, next) {
    try {
      const task = await Task.findOne({ _id: req.params.id, orgId: req.user.orgId });
      if (!task) return res.status(404).json({ success: false, message: "Task not found" });

      const allowed = ["title", "description", "priority", "dueDate", "assignedTo", "assignedToName", "lead", "leadName", "project", "projectName"];
      for (const key of allowed) {
        if (req.body[key] !== undefined) task[key] = req.body[key];
      }
      await task.save();
      res.json({ success: true, task });
    } catch (err) { next(err); }
  },

  // DELETE /api/tasks/:id  — admin/manager only
  async remove(req, res, next) {
    try {
      const task = await Task.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId });
      if (!task) return res.status(404).json({ success: false, message: "Task not found" });
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  // PATCH /api/tasks/:id/complete  — all roles
  async complete(req, res, next) {
    try {
      const task = await Task.findOne({ _id: req.params.id, orgId: req.user.orgId });
      if (!task) return res.status(404).json({ success: false, message: "Task not found" });

      task.status         = "completed";
      task.completedAt    = new Date();
      task.completionNote = req.body.note || "";
      await task.save();
      res.json({ success: true, task });
    } catch (err) { next(err); }
  },
};

module.exports = taskController;
