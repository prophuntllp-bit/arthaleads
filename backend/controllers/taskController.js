const Task = require("../models/Task");
const { sendPushToUser } = require("../utils/push");
const taskService = require("../services/taskService");
const User = require("../models/User");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const Project = require("../models/Project");

// Everything a task points at (the assignee, a lead, a project) must belong to
// the caller's organisation. Empty values mean "not linked" and are stored as
// null, never as an empty string (which is not a valid id).
async function checkTaskRefs(body, orgId) {
  const out = {};
  if ("assignedTo" in body) {
    if (!body.assignedTo) return { error: "Choose who the task is for." };
    const u = await User.findOne({ _id: body.assignedTo, orgId, isActive: true }).select("_id").lean().catch(() => null);
    if (!u) return { error: "That person is not on your team." };
  }
  if ("lead" in body) {
    if (!body.lead) { out.lead = null; out.leadName = ""; }
    else {
      const ok = (await Lead.exists({ _id: body.lead, orgId }).catch(() => null)) || (await ProjectLead.exists({ _id: body.lead, orgId }).catch(() => null));
      if (!ok) return { error: "That lead was not found." };
    }
  }
  if ("project" in body) {
    if (!body.project) { out.project = null; out.projectName = ""; }
    else if (!(await Project.exists({ _id: body.project, orgId }).catch(() => null))) return { error: "That project was not found." };
  }
  return { out };
}

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
      const refs = await checkTaskRefs({ assignedTo, lead, project }, user.orgId);
      if (refs.error) return res.status(400).json({ success: false, message: refs.error });

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

      // Notify the assignee — skip if they assigned it to themselves
      if (String(task.assignedTo) !== String(user._id)) {
        sendPushToUser(task.assignedTo, {
          type: "task_assigned",
          title: "New Task Assigned",
          body: `${user.name} assigned you a task: ${task.title}`,
          data: { url: "/tasks", taskId: String(task._id) },
        }).catch(() => {});
      }
    } catch (err) { next(err); }
  },

  // PATCH /api/tasks/:id  — admin/manager only
  async update(req, res, next) {
    try {
      const task = await Task.findOne({ _id: req.params.id, orgId: req.user.orgId });
      if (!task) return res.status(404).json({ success: false, message: "Task not found" });

      const refs = await checkTaskRefs(req.body, req.user.orgId);
      if (refs.error) return res.status(400).json({ success: false, message: refs.error });
      for (const k of Object.keys(refs.out)) req.body[k] = refs.out[k];

      const prevAssignedTo = String(task.assignedTo);
      const allowed = ["title", "description", "priority", "dueDate", "assignedTo", "assignedToName", "lead", "leadName", "project", "projectName"];
      for (const key of allowed) {
        if (req.body[key] !== undefined) task[key] = req.body[key];
      }
      await task.save();
      res.json({ success: true, task });

      // Notify the new assignee on reassignment — skip if unchanged or self-assigned
      if (String(task.assignedTo) !== prevAssignedTo && String(task.assignedTo) !== String(req.user._id)) {
        sendPushToUser(task.assignedTo, {
          type: "task_assigned",
          title: "New Task Assigned",
          body: `${req.user.name} assigned you a task: ${task.title}`,
          data: { url: "/tasks", taskId: String(task._id) },
        }).catch(() => {});
      }
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
      const task = await taskService.complete(req.params.id, req.body.note, req.user);
      res.json({ success: true, task });
    } catch (err) { next(err); }
  },
};

module.exports = taskController;
