
const express = require("express");
const mongoose = require("mongoose");
const { auth } = require("../middleware/auth");

const Activity = require("../models/Activity");
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const Opportunity = require("../models/Opportunity");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");

const router = express.Router();
router.use(auth);

const TYPES = ["Call", "Email", "Meeting", "Task", "Note", "Other"];
const STATUSES = ["Planned", "In Progress", "Completed", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High"];

const editableFields = [
  "subject",
  "description",
  "type",
  "status",
  "priority",
  "activityDate",
  "customer",
  "lead",
  "opportunity",
  "assignedTo",
];

function isManager(user) {
  return ["Admin", "Manager"].includes(user.role);
}

function canAccess(item, user) {
  if (isManager(user)) return true;

  return (
    String(item.createdBy) === String(user.id) ||
    String(item.assignedTo || "") === String(user.id)
  );
}

function scopeFor(user) {
  if (isManager(user)) return {};

  return {
    $or: [{ createdBy: user.id }, { assignedTo: user.id }],
  };
}

async function audit(req, action, item, details = "") {
  try {
    await AuditLog.create({
      userId: req.user.id,
      action,
      entityName: "Activity",
      recordId: String(item._id),
      details,
    });
  } catch (error) {
    // Keep the activity operation working if audit logging fails.
    console.error("Activity audit log error:", error.message);
  }
}

function validateBody(body, isCreate = false) {
  if (
    isCreate &&
    (typeof body.subject !== "string" || !body.subject.trim())
  ) {
    return "Activity subject is required";
  }

  if (
    body.subject !== undefined &&
    (typeof body.subject !== "string" ||
      !body.subject.trim() ||
      body.subject.trim().length > 150)
  ) {
    return "Subject must be between 1 and 150 characters";
  }

  if (
    body.description !== undefined &&
    (typeof body.description !== "string" ||
      body.description.length > 2000)
  ) {
    return "Description cannot exceed 2000 characters";
  }

  if (body.type !== undefined && !TYPES.includes(body.type)) {
    return "Invalid activity type";
  }

  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return "Invalid activity status";
  }

  if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
    return "Invalid activity priority";
  }

  if (isCreate && !body.activityDate) {
    return "Activity date is required";
  }

  if (body.activityDate !== undefined) {
    const date = new Date(body.activityDate);
    if (!body.activityDate || Number.isNaN(date.getTime())) {
      return "Invalid activity date";
    }
  }

  const links = ["customer", "lead", "opportunity"].filter(
    (field) => body[field] !== undefined && body[field] !== null && body[field] !== ""
  );

  if (links.length > 1) {
    return "Link an activity to only one customer, lead, or opportunity";
  }

  for (const field of ["customer", "lead", "opportunity", "assignedTo"]) {
    if (
      body[field] &&
      !mongoose.Types.ObjectId.isValid(String(body[field]))
    ) {
      return `Invalid ${field} ID`;
    }
  }

  return null;
}

async function validateReferences(body) {
  const checks = [
    ["customer", Customer],
    ["lead", Lead],
    ["opportunity", Opportunity],
    ["assignedTo", User],
  ];

  for (const [field, Model] of checks) {
    if (body[field]) {
      const record = await Model.findById(body[field]).select("_id");
      if (!record) return `${field} record was not found`;
    }
  }

  return null;
}

// GET /api/activities
router.get("/", async (req, res) => {
  try {
    const filter = { ...scopeFor(req.user) };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.priority) {
      filter.priority = req.query.priority;
    }

    if (req.query.search) {
      const search = req.query.search.trim().slice(0, 100);
      const regex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      const searchCondition = {
        $or: [
          { subject: regex },
          { description: regex },
        ],
      };

      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          searchCondition,
        ];
        delete filter.$or;
      } else {
        Object.assign(filter, searchCondition);
      }
    }

    const activities = await Activity.find(filter)
      .populate("customer", "customerName")
      .populate("lead", "leadName")
      .populate("opportunity", "name")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ activityDate: -1 })
      .limit(200)
      .lean();

    res.json(activities);
  } catch (error) {
    console.error("List activities error:", error.message);
    res.status(500).json({ message: "Could not load activities" });
  }
});

// GET /api/activities/:id
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid activity ID" });
    }

    const item = await Activity.findById(req.params.id)
      .populate("customer", "customerName")
      .populate("lead", "leadName")
      .populate("opportunity", "name")
      .populate("assignedTo", "name email");

    if (!item) {
      return res.status(404).json({ message: "Activity not found" });
    }

    if (!canAccess(item, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(item);
  } catch (error) {
    console.error("Get activity error:", error.message);
    res.status(500).json({ message: "Could not load activity" });
  }
});

// POST /api/activities
router.post("/", async (req, res) => {
  try {
    const validationError = validateBody(req.body, true);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const referenceError = await validateReferences(req.body);
    if (referenceError) {
      return res.status(400).json({ message: referenceError });
    }

    const data = {};
    for (const field of editableFields) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    if (!isManager(req.user)) {
      data.assignedTo = req.user.id;
    }

    data.createdBy = req.user.id;

    const item = await Activity.create(data);
    await audit(req, "CREATE", item, `Created activity: ${item.subject}`);

    res.status(201).json(item);
  } catch (error) {
    console.error("Create activity error:", error.message);
    res.status(400).json({
      message: error.name === "ValidationError"
        ? error.message
        : "Could not create activity",
    });
  }
});

// PUT /api/activities/:id
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid activity ID" });
    }

    const item = await Activity.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Activity not found" });
    }

    if (!canAccess(item, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const data = {};
    for (const field of editableFields) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    if (!isManager(req.user)) {
      delete data.assignedTo;
    }

    const merged = { ...item.toObject(), ...data };
    const validationError = validateBody(merged, true);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const referenceError = await validateReferences(data);
    if (referenceError) {
      return res.status(400).json({ message: referenceError });
    }

    Object.assign(item, data);
    await item.save();
    await audit(req, "UPDATE", item, `Updated activity: ${item.subject}`);

    res.json(item);
  } catch (error) {
    console.error("Update activity error:", error.message);
    res.status(400).json({
      message: error.name === "ValidationError"
        ? error.message
        : "Could not update activity",
    });
  }
});

// DELETE /api/activities/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid activity ID" });
    }

    const item = await Activity.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Activity not found" });
    }

    if (!canAccess(item, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    await audit(req, "DELETE", item, `Deleted activity: ${item.subject}`);
    await item.deleteOne();

    res.json({ message: "Activity deleted successfully" });
  } catch (error) {
    console.error("Delete activity error:", error.message);
    res.status(500).json({ message: "Could not delete activity" });
  }
});

module.exports = router;
