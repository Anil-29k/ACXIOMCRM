const router = require("express").Router();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const { auth, allowRoles } = require("../middleware/auth");

const ROLES = ["Admin", "Manager", "SalesExecutive"];
router.use(auth, allowRoles("Admin"));

function publicUser(user) {
  return {
    id: user._id, name: user.name, email: user.email, role: user.role,
    isActive: user.isActive, failedLoginAttempts: user.failedLoginAttempts,
    lockUntil: user.lockUntil, createdAt: user.createdAt,
  };
}

router.get("/", async (req, res) => {
  try {
    const users = await User.find()
      .select("name email role isActive failedLoginAttempts lockUntil createdAt")
      .sort({ createdAt: -1 }).lean();
    res.json(users);
  } catch { res.status(500).json({ message: "Could not load users" }); }
});

router.post("/", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = req.body.role || "SalesExecutive";
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return res.status(400).json({ message: "Name, valid email and password (8+ characters) are required" });
    }
    if (!ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), role });
    await AuditLog.create({ userId: req.user.id, action: "CREATE", entityName: "User", recordId: String(user._id), details: `Created ${role} account ${email}` });
    res.status(201).json(publicUser(user));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Email already registered" });
    res.status(500).json({ message: "Could not create user" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid user ID" });
    if (String(req.user.id) === req.params.id && req.body.isActive === false) return res.status(400).json({ message: "You cannot deactivate your own account" });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (req.body.role !== undefined) {
      if (!ROLES.includes(req.body.role)) return res.status(400).json({ message: "Invalid role" });
      user.role = req.body.role;
    }
    if (req.body.isActive !== undefined) user.isActive = Boolean(req.body.isActive);
    if (req.body.password !== undefined) {
      if (String(req.body.password).length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      user.password = await bcrypt.hash(String(req.body.password), 12);
      user.failedLoginAttempts = 0; user.lockUntil = null;
    }
    await user.save();
    await AuditLog.create({ userId: req.user.id, action: "UPDATE", entityName: "User", recordId: String(user._id), details: `Updated account ${user.email}` });
    res.json(publicUser(user));
  } catch { res.status(500).json({ message: "Could not update user" }); }
});

module.exports = router;
