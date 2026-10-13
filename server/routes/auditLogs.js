
const express = require("express");
const mongoose = require("mongoose");
const { auth } = require("../middleware/auth");
const AuditLog = require("../models/AuditLog");

const router = express.Router();
router.use(auth);

router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.user.role !== "Admin" && req.user.role !== "Manager") {
      filter.userId = req.user.id;
    }

    if (req.query.action) {
      filter.action = req.query.action;
    }

    if (req.query.entityName) {
      filter.entityName = req.query.entityName;
    }

    if (req.query.search) {
      const escaped = req.query.search
        .trim()
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { action: regex },
        { entityName: regex },
        { details: regex },
        { recordId: regex },
      ];
    }

    const logs = await AuditLog.find(filter)
      .populate("userId", "name email role")
      .sort({ createdDate: -1 })
      .limit(500)
      .lean();

    res.json(logs);
  } catch (error) {
    console.error("Audit log retrieval error:", error.message);
    res.status(500).json({ message: "Could not load audit logs" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid audit log ID" });
    }

    const filter = { _id: req.params.id };

    if (req.user.role !== "Admin" && req.user.role !== "Manager") {
      filter.userId = req.user.id;
    }

    const log = await AuditLog.findOne(filter)
      .populate("userId", "name email role")
      .lean();

    if (!log) {
      return res.status(404).json({ message: "Audit log not found" });
    }

    res.json(log);
  } catch (error) {
    console.error("Audit log detail error:", error.message);
    res.status(500).json({ message: "Could not load audit log" });
  }
});

module.exports = router;
