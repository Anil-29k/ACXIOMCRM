
const express = require("express");
const mongoose = require("mongoose");
const FollowUp = require("../models/FollowUp");
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const Opportunity = require("../models/Opportunity");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const { auth } = require("../middleware/auth");

const router = express.Router();
router.use(auth);

const TYPES = ["Call", "Email", "Meeting", "Task", "Other"];
const STATUSES = ["Pending", "Completed", "Missed", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High"];
const REFERENCES = ["customer", "lead", "opportunity", "assignedTo"];

const isManager = (user) =>
  ["Admin", "Manager"].includes(user.role);

const canAccess = (record, user) =>
  isManager(user) ||
  String(record.createdBy) === String(user.id) ||
  String(record.assignedTo) === String(user.id);

async function writeAudit(req, action, record) {
  await AuditLog.create({
    userId: req.user.id,
    action,
    entityName: "FollowUp",
    recordId: String(record._id),
    details: record.title
  });
}

function validateInput(body, creating = false) {
  if (creating && !String(body.title || "").trim()) {
    return "Follow-up title is required";
  }

  if (body.type !== undefined && !TYPES.includes(body.type)) {
    return "Invalid follow-up type";
  }

  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return "Invalid follow-up status";
  }

  if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
    return "Invalid follow-up priority";
  }

  for (const field of REFERENCES) {
    if (body[field] && !mongoose.isValidObjectId(body[field])) {
      return `${field} is invalid`;
    }
  }

  const linked = ["customer", "lead", "opportunity"]
    .filter((field) => body[field]);

  if (linked.length > 1) {
    return "Link a follow-up to only one customer, lead, or opportunity";
  }

  if (body.dueDate !== undefined) {
    const date = new Date(body.dueDate);

    if (Number.isNaN(date.getTime())) {
      return "A valid due date is required";
    }

    if (
      creating &&
      date < new Date(new Date().setHours(0, 0, 0, 0))
    ) {
      return "A new follow-up date cannot be in the past";
    }
  }

  return null;
}

async function validateReferences(body) {
  if (body.customer && !(await Customer.exists({ _id: body.customer }))) {
    return "Customer not found";
  }

  if (body.lead && !(await Lead.exists({ _id: body.lead }))) {
    return "Lead not found";
  }

  if (
    body.opportunity &&
    !(await Opportunity.exists({ _id: body.opportunity }))
  ) {
    return "Opportunity not found";
  }

  if (body.assignedTo && !(await User.exists({ _id: body.assignedTo }))) {
    return "Assigned user not found";
  }

  return null;
}

const editableFields = [
  "title", "description", "type", "dueDate", "status",
  "priority", "customer", "lead", "opportunity", "assignedTo"
];

function pickFields(body) {
  return Object.fromEntries(
    editableFields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]])
  );
}

function populateQuery(query) {
  return query
    .populate("customer", "customerName companyName")
    .populate("lead", "leadName companyName")
    .populate("opportunity", "name amount stage")
    .populate("assignedTo", "name email");
}

// GET /api/followups
router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.query.status) {
      if (!STATUSES.includes(req.query.status)) {
        return res.status(400).json({ message: "Invalid status filter" });
      }
      filter.status = req.query.status;
    }

    if (req.query.priority) {
      if (!PRIORITIES.includes(req.query.priority)) {
        return res.status(400).json({ message: "Invalid priority filter" });
      }
      filter.priority = req.query.priority;
    }

    if (!isManager(req.user)) {
      filter.$or = [
        { createdBy: req.user.id },
        { assignedTo: req.user.id }
      ];
    }

    const records = await populateQuery(
      FollowUp.find(filter)
        .sort({ dueDate: 1 })
        .limit(200)
    ).lean();

    res.json(records);
  } catch (error) {
    console.error("Load follow-ups:", error.message);
    res.status(500).json({ message: "Could not load follow-ups" });
  }
});

// GET /api/followups/:id
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid follow-up ID" });
    }

    const record = await populateQuery(
      FollowUp.findById(req.params.id)
    );

    if (!record) {
      return res.status(404).json({ message: "Follow-up not found" });
    }

    if (!canAccess(record, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: "Could not load follow-up" });
  }
});

// POST /api/followups
router.post("/", async (req, res) => {
  try {
    const validationError = validateInput(req.body, true);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const referenceError = await validateReferences(req.body);
    if (referenceError) {
      return res.status(400).json({ message: referenceError });
    }

    const input = pickFields(req.body);

    // Sales Executives cannot assign follow-ups to other users.
    if (!isManager(req.user)) {
      input.assignedTo = req.user.id;
    }

    const record = await FollowUp.create({
      ...input,
      createdBy: req.user.id
    });

    try {
      await writeAudit(req, "CREATE", record);
    } catch (auditError) {
      console.error("Follow-up audit error:", auditError.message);
    }

    res.status(201).json(record);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: error.message });
    }

    console.error("Create follow-up:", error.message);
    res.status(500).json({ message: "Could not create follow-up" });
  }
});

// PUT /api/followups/:id
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid follow-up ID" });
    }

    const record = await FollowUp.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: "Follow-up not found" });
    }

    if (!canAccess(record, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const validationError = validateInput(req.body, false);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const updates = pickFields(req.body);
    const merged = { ...record.toObject(), ...updates };

    const linked = ["customer", "lead", "opportunity"]
      .filter((field) => merged[field]);

    if (linked.length > 1) {
      return res.status(400).json({
        message: "Link a follow-up to only one customer, lead, or opportunity"
      });
    }

    const referenceError = await validateReferences(updates);
    if (referenceError) {
      return res.status(400).json({ message: referenceError });
    }

    if (!isManager(req.user)) {
      delete updates.assignedTo;
    }

    Object.assign(record, updates);
    await record.save();

    try {
      await writeAudit(req, "UPDATE", record);
    } catch (auditError) {
      console.error("Follow-up audit error:", auditError.message);
    }

    res.json(record);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: error.message });
    }

    console.error("Update follow-up:", error.message);
    res.status(500).json({ message: "Could not update follow-up" });
  }
});

// DELETE /api/followups/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid follow-up ID" });
    }

    const record = await FollowUp.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: "Follow-up not found" });
    }

    if (!canAccess(record, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    await record.deleteOne();

    try {
      await writeAudit(req, "DELETE", record);
    } catch (auditError) {
      console.error("Follow-up audit error:", auditError.message);
    }

    res.json({ message: "Follow-up deleted successfully" });
  } catch (error) {
    console.error("Delete follow-up:", error.message);
    res.status(500).json({ message: "Could not delete follow-up" });
  }
});

module.exports = router;
