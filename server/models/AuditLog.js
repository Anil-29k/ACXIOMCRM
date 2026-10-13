const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  action: { type: String, required: true },
  entityName: { type: String, required: true },
  recordId: String,
  details: String,
  createdDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model("AuditLog", auditSchema);