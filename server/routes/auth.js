const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const { auth } = require("../middleware/auth");

const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again later.",
  },
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() ||
        !password || password.length < 8) {
      return res.status(400).json({
        message: "Name, valid email and password (8+ characters) required"
      });
    }

    const existing = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Public registration must never allow self-assigned Admin/Manager roles.
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: await bcrypt.hash(password, 12),
      role: "SalesExecutive"
    });

    await AuditLog.create({
      userId: user._id,
      action: "REGISTER",
      entityName: "User",
      recordId: String(user._id)
    });

    res.status(201).json({ message: "Registration successful" });
  } catch (err) {
    res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(423).json({ message: "Account temporarily locked" });
    }

    const valid = await bcrypt.compare(password || "", user.password);

    if (!valid) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 5 * 60 * 1000);
        user.failedLoginAttempts = 0;
      }

      await user.save();

      await AuditLog.create({
        userId: user._id,
        action: "LOGIN_FAILED",
        entityName: "User"
      });

      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    const token = jwt.sign({
      id: String(user._id),
      role: user.role,
      name: user.name
    }, process.env.JWT_SECRET, { expiresIn: "4h" });

    await AuditLog.create({
      userId: user._id,
      action: "LOGIN_SUCCESS",
      entityName: "User"
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});

// Add this route inside auth.js, before module.exports.
router.post("/logout", auth, async (req, res) => {
  try {
    res.json({
      message: "Logout successful. Remove the token on the client.",
    });
  } catch (error) {
    res.status(500).json({ message: "Logout failed" });
  }
});


module.exports = router;