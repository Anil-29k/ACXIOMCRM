
const express = require("express");
const mongoose = require("mongoose");
const Opportunity = require("../models/Opportunity");
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const { auth } = require("../middleware/auth");

const router = express.Router();
router.use(auth);

const STAGES = [
  "Qualification",
  "Needs Analysis",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost"
];

const isManager = (user) =>
  ["Admin", "Manager"].includes(user.role);

const canAccess = (record, user) =>
  isManager(user) ||
  String(record.createdBy) === String(user.id) ||
  String(record.assignedTo) === String(user.id);

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function writeAudit(req, action, record) {
  await AuditLog.create({
    userId: req.user.id,
    action,
    entityName: "Opportunity",
    recordId: String(record._id),
    details: record.name
  });
}

function validateBody(body, creating = false) {
  if (creating && !String(body.name || "").trim()) {
    return "Opportunity name is required";
  }

  if (body.stage !== undefined && !STAGES.includes(body.stage)) {
    return "Invalid opportunity stage";
  }

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return "Amount must be a non-negative number";
    }
    if (body.stage && !["Won", "Lost"].includes(body.stage) && amount <= 0) {
      return "Active opportunities must have an amount greater than zero";
    }
  }

  if (body.probability !== undefined) {
    const probability = Number(body.probability);
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
      return "Probability must be between 0 and 100";
    }
  }

  if (body.expectedCloseDate) {
    const date = new Date(body.expectedCloseDate);
    if (Number.isNaN(date.getTime())) {
      return "Invalid expected close date";
    }
    if (
      body.stage !== "Won" &&
      body.stage !== "Lost" &&
      date < new Date(new Date().setHours(0, 0, 0, 0))
    ) {
      return "Expected close date cannot be in the past for an active opportunity";
    }
  }

  for (const field of ["customer", "lead", "assignedTo"]) {
    if (body[field] && !mongoose.isValidObjectId(body[field])) {
      return `${field} is invalid`;
    }
  }

  if (body.customer && body.lead) {
    return "Link an opportunity to a customer or a lead, not both";
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

  if (body.assignedTo && !(await User.exists({ _id: body.assignedTo }))) {
    return "Assigned user not found";
  }

  return null;
}

const fields = [
  "name", "customer", "lead", "amount", "stage",
  "probability", "expectedCloseDate", "description", "assignedTo"
];

function pickFields(body) {
  return Object.fromEntries(
    fields.filter((key) => body[key] !== undefined)
      .map((key) => [key, body[key]])
  );
}

// GET /api/opportunities?search=&stage=
router.get("/", async (req, res) => {
  try {
    const filter = {};
    const { search, stage } = req.query;

    if (stage) {
      if (!STAGES.includes(stage)) {
        return res.status(400).json({ message: "Invalid opportunity stage" });
      }
      filter.stage = stage;
    }

    if (search) {
      if (typeof search !== "string") {
        return res.status(400).json({ message: "Invalid search value" });
      }
      const safe = escapeRegex(search.trim());
      filter.name = { $regex: safe, $options: "i" };
    }

    if (!isManager(req.user)) {
      filter.$or = [
        { createdBy: req.user.id },
        { assignedTo: req.user.id }
      ];
    }

    const records = await Opportunity.find(filter)
      .populate("customer", "customerName companyName")
      .populate("lead", "leadName companyName")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json(records);
  } catch (error) {
    console.error("Load opportunities:", error.message);
    res.status(500).json({ message: "Could not load opportunities" });
  }
});

// GET /api/opportunities/:id
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid opportunity ID" });
    }

    const record = await Opportunity.findById(req.params.id)
      .populate("customer", "customerName companyName")
      .populate("lead", "leadName companyName")
      .populate("assignedTo", "name email");

    if (!record) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    if (!canAccess(record, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: "Could not load opportunity" });
  }
});

// POST /api/opportunities
router.post("/", async (req, res) => {
  try {
    const error = validateBody(req.body, true) ||
      await validateReferences(req.body);

    if (error) return res.status(400).json({ message: error });

    const record = await Opportunity.create({
      ...pickFields(req.body),
      createdBy: req.user.id,
      ...(!isManager(req.user) ? { assignedTo: req.user.id } : {})
    });

    try {
      await writeAudit(req, "CREATE", record);
    } catch (auditError) {
      console.error("Opportunity audit error:", auditError.message);
    }

    res.status(201).json(record);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Create opportunity:", error.message);
    res.status(500).json({ message: "Could not create opportunity" });
  }
});

// PUT /api/opportunities/:id
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid opportunity ID" });
    }

    const record = await Opportunity.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    if (!canAccess(record, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updates = pickFields(req.body);
    const merged = { ...record.toObject(), ...updates };
    const error = validateBody(merged) ||
      await validateReferences(updates);

    if (error) return res.status(400).json({ message: error });

    // Sales Executives cannot reassign opportunities.
    if (!isManager(req.user)) {
      delete updates.assignedTo;
    }

    Object.assign(record, updates);
    await record.save();

    try {
      await writeAudit(req, "UPDATE", record);
    } catch (auditError) {
      console.error("Opportunity audit error:", auditError.message);
    }

    res.json(record);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Update opportunity:", error.message);
    res.status(500).json({ message: "Could not update opportunity" });
  }
});

// DELETE /api/opportunities/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid opportunity ID" });
    }

    const record = await Opportunity.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    if (!canAccess(record, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    await record.deleteOne();

    try {
      await writeAudit(req, "DELETE", record);
    } catch (auditError) {
      console.error("Opportunity audit error:", auditError.message);
    }

    res.json({ message: "Opportunity deleted successfully" });
  } catch (error) {
    console.error("Delete opportunity:", error.message);
    res.status(500).json({ message: "Could not delete opportunity" });
  }
});

module.exports = router;
