const { objectId, Joi } = require("./_shared");
const taskService = require("../services/taskService");
const Task = require("../models/Task");

module.exports = {
  id: "complete_task",
  scopeLabel: "Tasks",
  pages: ["/tasks", "/dashboard", "/"],
  roles: ["admin", "manager", "agent"],
  params: Joi.object({
    taskId: objectId.required(),
    note: Joi.string().allow("").max(500).optional(),
  }),
  describe: {
    summary: "Mark a task as completed",
    params: "{ taskId, note? } - taskId must come from context; note is optional",
    when: "Only propose when a specific task id is present in the live context.",
  },

  async preview({ params, user }) {
    const task = await Task.findOne({ _id: params.taskId, orgId: user.orgId }).select("title status").lean();
    if (!task) return { subject: "Task", fields: [] };
    return {
      subject: task.title,
      fields: [{ label: "Status", from: task.status, to: "completed" }],
    };
  },

  async execute({ params, user }) {
    const task = await taskService.complete(params.taskId, params.note, user);
    return { message: `Task "${task.title}" marked as completed.`, data: { taskId: params.taskId } };
  },
};
