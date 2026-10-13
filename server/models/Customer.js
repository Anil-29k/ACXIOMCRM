const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: [true, "Customer name is required"],
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email"]
  },
  phone: {
    type: String,
    required: true,
    match: [/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile"]
  },
  companyName: { type: String, trim: true, default: "" },
  address: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active"
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

customerSchema.index({ email: 1 }, { unique: true });
customerSchema.index({ phone: 1 }, { unique: true });

module.exports = mongoose.model("Customer", customerSchema);