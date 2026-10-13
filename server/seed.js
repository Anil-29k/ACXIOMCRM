require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Customer = require("./models/Customer");
const Lead = require("./models/Lead");
const Opportunity = require("./models/Opportunity");
const FollowUp = require("./models/FollowUp");
const Activity = require("./models/Activity");
const AuditLog = require("./models/AuditLog");

const users = [
  { name: "Acxiom Administrator", email: "admin@acxiomcrm.local", password: "Admin@12345", role: "Admin" },
  { name: "Acxiom Manager", email: "manager@acxiomcrm.local", password: "Manager@12345", role: "Manager" },
  { name: "Acxiom Sales Executive", email: "sales@acxiomcrm.local", password: "Sales@12345", role: "SalesExecutive" },
];

async function seed() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing from .env");
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Customer.deleteMany({}), Lead.deleteMany({}), Opportunity.deleteMany({}), FollowUp.deleteMany({}), Activity.deleteMany({}), AuditLog.deleteMany({}), User.deleteMany({})]);

  const byRole = {};
  for (const account of users) {
    byRole[account.role] = await User.create({ ...account, password: await bcrypt.hash(account.password, 12), isActive: true });
  }
  const { Admin, Manager, SalesExecutive } = byRole;
  const [customerA, customerB] = await Customer.create([
    { customerName: "Aarav Mehta", email: "aarav@example.com", phone: "9876543210", companyName: "Mehta Technologies", city: "Bengaluru", state: "Karnataka", notes: "Enterprise CRM prospect", assignedTo: SalesExecutive._id, createdBy: Admin._id },
    { customerName: "Priya Sharma", email: "priya@example.com", phone: "8765432109", companyName: "Sharma Retail", city: "Mumbai", state: "Maharashtra", assignedTo: SalesExecutive._id, createdBy: Manager._id },
  ]);
  const [leadA, leadB] = await Lead.create([
    { leadName: "Rohan Kapoor", email: "rohan@example.com", phone: "7654321098", companyName: "Kapoor Finance", source: "Referral", status: "Qualified", priority: "High", expectedValue: 850000, assignedTo: SalesExecutive._id, createdBy: Manager._id },
    { leadName: "Neha Iyer", email: "neha@example.com", phone: "9876501234", companyName: "Iyer Design Studio", source: "Website", status: "Contacted", priority: "Medium", expectedValue: 320000, assignedTo: SalesExecutive._id, createdBy: SalesExecutive._id },
  ]);
  const [opportunityA, opportunityB] = await Opportunity.create([
    { name: "Mehta CRM Rollout", customer: customerA._id, amount: 650000, stage: "Proposal", probability: 65, expectedCloseDate: new Date(Date.now() + 21 * 86400000), assignedTo: SalesExecutive._id, createdBy: Manager._id, description: "Phase one CRM rollout" },
    { name: "Kapoor Finance Expansion", lead: leadA._id, amount: 850000, stage: "Negotiation", probability: 75, expectedCloseDate: new Date(Date.now() + 35 * 86400000), assignedTo: SalesExecutive._id, createdBy: Manager._id },
  ]);
  await FollowUp.create([
    { title: "Proposal review call", type: "Call", dueDate: new Date(Date.now() + 2 * 86400000), status: "Pending", priority: "High", customer: customerA._id, assignedTo: SalesExecutive._id, createdBy: Manager._id },
    { title: "Qualification meeting", type: "Meeting", dueDate: new Date(Date.now() - 2 * 86400000), status: "Missed", priority: "Medium", lead: leadA._id, assignedTo: SalesExecutive._id, createdBy: SalesExecutive._id },
    { title: "Contract email", type: "Email", dueDate: new Date(Date.now() - 5 * 86400000), status: "Completed", priority: "Low", opportunity: opportunityB._id, assignedTo: SalesExecutive._id, createdBy: Manager._id },
  ]);
  await Activity.create([
    { subject: "Discovery call completed", description: "Discussed current sales process.", type: "Call", status: "Completed", priority: "High", activityDate: new Date(Date.now() - 86400000), customer: customerA._id, assignedTo: SalesExecutive._id, createdBy: SalesExecutive._id },
    { subject: "Proposal follow-up", type: "Email", status: "Planned", priority: "Medium", activityDate: new Date(Date.now() + 86400000), opportunity: opportunityA._id, assignedTo: SalesExecutive._id, createdBy: Manager._id },
  ]);
  console.log("Reset and seeded AcxiomCRM: 3 users, 2 customers, 2 leads, 2 opportunities, 3 follow-ups, 2 activities.");
  await mongoose.disconnect();
}

seed().catch(async (error) => { console.error("Seed failed:", error.message); await mongoose.disconnect(); process.exitCode = 1; });
