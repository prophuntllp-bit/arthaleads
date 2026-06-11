const mongoose = require("mongoose");
const { Schema } = mongoose;

const taskSchema = new Schema(
  {
    org:             { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    title:           { type: String, required: true, trim: true, maxlength: 200 },
    description:     { type: String, trim: true, default: "" },
    priority:        { type: String, enum: ["critical", "high", "medium", "low"], default: "medium" },
    status:          { type: String, enum: ["pending", "completed"], default: "pending" },
    dueDate:         { type: Date, required: true },
    assignedTo:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedToName:  { type: String, default: "" },
    assignedBy:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedByName:  { type: String, default: "" },
    completionNote:  { type: String, default: "" },
    completedAt:     { type: Date, default: null },
    // Optional links
    lead:            { type: Schema.Types.ObjectId, ref: "Lead",    default: null },
    leadName:        { type: String, default: "" },
    project:         { type: Schema.Types.ObjectId, ref: "Project", default: null },
    projectName:     { type: String, default: "" },
  },
  { timestamps: true }
);

taskSchema.index({ org: 1, dueDate: 1 });
taskSchema.index({ org: 1, assignedTo: 1 });
taskSchema.index({ org: 1, status: 1 });

module.exports = mongoose.model("Task", taskSchema);
