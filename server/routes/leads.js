
const router = require("express").Router();
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const AuditLog = require("../models/AuditLog");
const { auth } = require("../middleware/auth");

router.use(auth);

const VALID_STATUSES = [
  "New", "Contacted", "Qualified", "Unqualified", "Lost", "Converted"
];

const VALID_SOURCES = [
  "Website", "Referral", "Social Media", "Cold Call", "Other"
];

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isAdminOrManager = (user) =>
  ["Admin", "Manager"].includes(user.role);

const canAccess = (lead, user) =>
  isAdminOrManager(user) ||
  String(lead.createdBy) === String(user.id) ||
  String(lead.assignedTo) === String(user.id);

async function writeAudit(userId, action, lead) {
  await AuditLog.create({
    userId,
    action,
    entityName: "Lead",
    recordId: String(lead._id)
  });
}


router.get("/", async (req, res) => {
  try {
    const { search = "", status } = req.query;
    const filter = {};

    if (typeof search !== "string" || typeof status === "object") {
      return res.status(400).json({ message: "Invalid search or status filter" });
    }

    if (search.trim()) {
      const safe = escapeRegex(search.trim());
      filter.$or = [
        { leadName: { $regex: safe, $options: "i" } },
        { companyName: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } }
      ];
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid lead status" });
      }
      filter.status = status;
    }

    if (!isAdminOrManager(req.user)) {
      const ownershipFilter = {
        $or: [
          { createdBy: req.user.id },
          { assignedTo: req.user.id }
        ]
      };

      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          ownershipFilter
        ];
        delete filter.$or;
      } else {
        Object.assign(filter, ownershipFilter);
      }
    }

    const leads = await Lead.find(filter)
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(leads);
  } catch (error) {
    console.error("Load leads error:", error.message);
    res.status(500).json({ message: "Could not load leads" });
  }
});

// GET one lead
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (!canAccess(lead, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: "Could not load lead" });
  }
});

// CREATE lead
router.post("/", async (req, res) => {
  try {
    const {
      leadName, email, phone, companyName,
      source, status, priority, expectedValue, assignedTo
    } = req.body;

    if (source && !VALID_SOURCES.includes(source)) {
      return res.status(400).json({ message: "Invalid lead source" });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid lead status" });
    }

    if (priority && !["Low", "Medium", "High"].includes(priority)) {
      return res.status(400).json({ message: "Invalid lead priority" });
    }

    if (assignedTo && !mongoose.isValidObjectId(assignedTo)) {
      return res.status(400).json({ message: "Invalid assigned user" });
    }

    if (
      expectedValue !== undefined &&
      (!Number.isFinite(Number(expectedValue)) || Number(expectedValue) < 0)
    ) {
      return res.status(400).json({
        message: "Expected value must be a non-negative number"
      });
    }

    const lead = await Lead.create({
      leadName,
      email,
      phone,
      companyName,
      source,
      status,
      priority,
      expectedValue,
      assignedTo: isAdminOrManager(req.user) ? assignedTo : req.user.id,
      createdBy: req.user.id
    });

    try {
      await writeAudit(req.user.id, "CREATE", lead);
    } catch (auditError) {
      console.error("Lead audit error:", auditError.message);
    }

    res.status(201).json(lead);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: Object.values(error.errors)
          .map((item) => item.message)
          .join(", ")
      });
    }

    console.error("Create lead error:", error.message);
    res.status(500).json({ message: "Could not create lead" });
  }
});

// UPDATE lead
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (!canAccess(lead, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const allowed = [
      "leadName", "email", "phone", "companyName",
      "source", "status", "priority", "expectedValue",
      ...(isAdminOrManager(req.user) ? ["assignedTo"] : [])
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        lead[key] = req.body[key];
      }
    }

    if (lead.source && !VALID_SOURCES.includes(lead.source)) {
      return res.status(400).json({ message: "Invalid lead source" });
    }

    if (!VALID_STATUSES.includes(lead.status)) {
      return res.status(400).json({ message: "Invalid lead status" });
    }

    if (!["Low", "Medium", "High"].includes(lead.priority)) {
      return res.status(400).json({ message: "Invalid lead priority" });
    }

    if (
      lead.expectedValue !== undefined &&
      (!Number.isFinite(Number(lead.expectedValue)) ||
        Number(lead.expectedValue) < 0)
    ) {
      return res.status(400).json({
        message: "Expected value must be a non-negative number"
      });
    }

    await lead.save();

    try {
      await writeAudit(req.user.id, "UPDATE", lead);
    } catch (auditError) {
      console.error("Lead audit error:", auditError.message);
    }

    res.json(lead);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: Object.values(error.errors)
          .map((item) => item.message)
          .join(", ")
      });
    }

    console.error("Update lead error:", error.message);
    res.status(500).json({ message: "Could not update lead" });
  }
});

// DELETE lead
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (!canAccess(lead, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Lead.findByIdAndDelete(lead._id);

    try {
      await writeAudit(req.user.id, "DELETE", lead);
    } catch (auditError) {
      console.error("Lead audit error:", auditError.message);
    }

    res.json({ message: "Lead deleted successfully" });
  } catch (error) {
    console.error("Delete lead error:", error.message);
    res.status(500).json({ message: "Could not delete lead" });
  }
});

module.exports = router;
