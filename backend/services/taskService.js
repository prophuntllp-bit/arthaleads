// services/taskService.js
//
// Task writes live here so the REST controller and the AI copilot share one
// implementation. Two copies of the same mutation is how the copilot ended up
// able to do things the UI forbids — see helpRoutes.js.

const Task = require("../models/Task");
const { AppError } = require("../middlewares/errorHandler");

// An agent works on the tasks assigned to them (that is all the list shows
// them); managers and admins can act on any task in the organisation.
function assertCanAct(task, user) {
  if (user.role === "agent" && String(task.assignedTo) !== String(user._id)) {
    throw new AppError("Task not found", 404);
  }
}

const taskService = {
  /**
   * The task list as GET /api/tasks shows it, with the summary counts. Agents
   * see only tasks assigned to them; managers and admins see the organisation
   * (optionally one person's, or their own with myOnly).
   */
  async list(user, { status, priority, assignedTo, projectId, from, to, myOnly } = {}) {
    const filter = { orgId: user.orgId };
    if (user.role === "agent" || myOnly === "true" || myOnly === true) {
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
    return { tasks, summary };
  },

  /**
   * Mark a task completed. Any role may complete a task they can see, which
   * matches PATCH /api/tasks/:id/complete.
   */
  async complete(id, note, user) {
    const task = await Task.findOne({ _id: id, orgId: user.orgId });
    if (!task) throw new AppError("Task not found", 404);
    assertCanAct(task, user);

    task.status = "completed";
    task.completedAt = new Date();
    task.completionNote = note || "";
    await task.save();
    return task;
  },

  /** Put a task back to pending — the inverse of complete(), for undo. */
  async reopen(id, user) {
    const task = await Task.findOne({ _id: id, orgId: user.orgId });
    if (!task) throw new AppError("Task not found", 404);
    assertCanAct(task, user);

    task.status = "pending";
    task.completedAt = null;
    task.completionNote = "";
    await task.save();
    return task;
  },
};

module.exports = taskService;
