
const router = require("express").Router();
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

router.use(auth);

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isAdminOrManager = (user) =>
  ["Admin", "Manager"].includes(user.role);

const canAccess = (customer, user) =>
  isAdminOrManager(user) ||
  String(customer.createdBy) === String(user.id) ||
  String(customer.assignedTo) === String(user.id);

async function writeAudit(userId, action, customer) {
  await AuditLog.create({
    userId,
    action,
    entityName: "Customer",
    recordId: String(customer._id)
  });
}

// GET all customers with search and status filtering
router.get("/", async (req, res) => {
  try {
    const { search = "", status } = req.query;
    const filter = {};

    if (search.trim()) {
      const safe = escapeRegex(search.trim());
      filter.$or = [
        { customerName: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
        { phone: { $regex: safe, $options: "i" } },
        { companyName: { $regex: safe, $options: "i" } }
      ];
    }

    if (status) {
      if (!["Active", "Inactive"].includes(status)) {
        return res.status(400).json({ message: "Invalid customer status" });
      }
      filter.status = status;
    }

    // Sales executives see customers they created.
    // Admins and managers can view all customers.
    if (!isAdminOrManager(req.user)) {
      const ownership = { $or: [{ createdBy: req.user.id }, { assignedTo: req.user.id }] };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, ownership];
        delete filter.$or;
      } else {
        Object.assign(filter, ownership);
      }
    }

    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(customers);
  } catch (error) {
    console.error("Load customers error:", error.message);
    res.status(500).json({ message: "Could not load customers" });
  }
});

// GET one customer
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (!canAccess(customer, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(customer);
  } catch (error) {
    console.error("Get customer error:", error.message);
    res.status(500).json({ message: "Could not load customer" });
  }
});

// CREATE customer
router.post("/", async (req, res) => {
  try {
    const {
      customerName, email, phone, companyName,
      address, city, state, status, notes, assignedTo
    } = req.body;

    if (assignedTo && !(await User.exists({ _id: assignedTo, role: "SalesExecutive", isActive: true }))) {
      return res.status(400).json({ message: "Assigned sales executive not found" });
    }

    const customer = await Customer.create({
      customerName,
      email,
      phone,
      companyName,
      address,
      city,
      state,
      status,
      notes,
      assignedTo: isAdminOrManager(req.user) ? assignedTo : req.user.id,
      createdBy: req.user.id
    });

    try {
      await writeAudit(req.user.id, "CREATE", customer);
    } catch (auditError) {
      console.error("Customer audit error:", auditError.message);
    }

    res.status(201).json(customer);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Customer email or phone already exists"
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: Object.values(error.errors)
          .map((item) => item.message)
          .join(", ")
      });
    }

    console.error("Create customer error:", error.message);
    res.status(500).json({ message: "Could not create customer" });
  }
});

// UPDATE customer
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (!canAccess(customer, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const allowed = [
      "customerName", "email", "phone", "companyName",
      "address", "city", "state", "status", "notes", "assignedTo"
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        customer[key] = req.body[key];
      }
    }

    if (customer.assignedTo && !(await User.exists({ _id: customer.assignedTo, role: "SalesExecutive", isActive: true }))) {
      return res.status(400).json({ message: "Assigned sales executive not found" });
    }
    if (!isAdminOrManager(req.user)) customer.assignedTo = req.user.id;

    await customer.save();

    try {
      await writeAudit(req.user.id, "UPDATE", customer);
    } catch (auditError) {
      console.error("Customer audit error:", auditError.message);
    }

    res.json(customer);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Customer email or phone already exists"
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: Object.values(error.errors)
          .map((item) => item.message)
          .join(", ")
      });
    }

    console.error("Update customer error:", error.message);
    res.status(500).json({ message: "Could not update customer" });
  }
});

// DELETE customer
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (!canAccess(customer, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Customer.findByIdAndDelete(customer._id);

    try {
      await writeAudit(req.user.id, "DELETE", customer);
    } catch (auditError) {
      console.error("Customer audit error:", auditError.message);
    }

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Delete customer error:", error.message);
    res.status(500).json({ message: "Could not delete customer" });
  }
});

module.exports = router;
