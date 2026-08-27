// services/taskService.js
//
// Task writes live here so the REST controller and the AI copilot share one
// implementation. Two copies of the same mutation is how the copilot ended up
// able to do things the UI forbids — see helpRoutes.js.

const Task = require("../models/Task");
const { AppError } = require("../middlewares/errorHandler");

const taskService = {
  /**
   * Mark a task completed. Any role may complete a task they can see, which
   * matches PATCH /api/tasks/:id/complete.
   */
  async complete(id, note, user) {
    const task = await Task.findOne({ _id: id, orgId: user.orgId });
    if (!task) throw new AppError("Task not found", 404);

    task.status = "completed";
    task.completedAt = new Date();
    task.completionNote = note || "";
    await task.save();
    return task;
  },
};

module.exports = taskService;
