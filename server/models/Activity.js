
const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, "Activity subject is required"],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    type: {
      type: String,
      enum: ["Call", "Email", "Meeting", "Task", "Note", "Other"],
      required: true,
      default: "Call",
    },
    status: {
      type: String,
      enum: ["Planned", "In Progress", "Completed", "Cancelled"],
      default: "Planned",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    activityDate: {
      type: Date,
      required: [true, "Activity date is required"],
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },
    opportunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

activitySchema.index({ activityDate: 1, status: 1 });
activitySchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model("Activity", activitySchema);
