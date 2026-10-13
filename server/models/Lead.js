const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema({
  leadName: {
    type: String,
    required: [true, "Lead name is required"],
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"],
    default: ""
  },
  phone: {
    type: String,
    required: true,
    match: [/^[6-9]\d{9}$/, "Enter a valid mobile number"]
  },
  companyName: { type: String, default: "" },
  source: {
    type: String,
    enum: ["Website", "Referral", "Social Media", "Cold Call", "Other"],
    default: "Other"
  },
  status: {
    type: String,
    enum: ["New", "Contacted", "Qualified", "Unqualified", "Lost", "Converted"],
    default: "New"
  },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium"
  },
  expectedValue: { type: Number, min: 0, default: 0 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

module.exports = mongoose.model("Lead", leadSchema);
