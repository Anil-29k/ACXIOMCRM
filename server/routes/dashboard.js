
const express = require("express");
const { auth } = require("../middleware/auth");

const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const Opportunity = require("../models/Opportunity");
const FollowUp = require("../models/FollowUp");

const router = express.Router();
router.use(auth);

const isManager = (user) =>
  ["Admin", "Manager"].includes(user.role);

function scopeFor(user) {
  if (isManager(user)) return {};

  return {
    $or: [
      { createdBy: user.id },
      { assignedTo: user.id }
    ]
  };
}

function scopedMatch(user, extra = {}) {
  const scope = scopeFor(user);

  return Object.keys(scope).length
    ? { $and: [scope, extra] }
    : extra;
}

// GET /api/dashboard/stats
router.get("/stats", async (req, res) => {
  try {
    const now = new Date();

    const customerScope = scopeFor(req.user);
    const leadScope = scopeFor(req.user);
    const opportunityScope = scopeFor(req.user);
    const followUpScope = scopeFor(req.user);

    const [
      totalCustomers,
      activeCustomers,
      totalLeads,
      leadStatusCounts,
      totalOpportunities,
      opportunityStageCounts,
      activePipeline,
      pendingFollowUps,
      overdueFollowUps,
      completedFollowUps
    ] = await Promise.all([
      Customer.countDocuments(customerScope),
      Customer.countDocuments({
        ...customerScope,
        status: "Active"
      }),

      Lead.countDocuments(leadScope),
      Lead.aggregate([
        { $match: leadScope },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),

      Opportunity.countDocuments(opportunityScope),
      Opportunity.aggregate([
        { $match: opportunityScope },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),

      Opportunity.aggregate([
        {
          $match: scopedMatch(req.user, {
            stage: { $nin: ["Won", "Lost"] }
          })
        },
        {
          $group: {
            _id: null,
            totalValue: { $sum: "$amount" },
            weightedValue: {
              $sum: {
                $multiply: [
                  "$amount",
                  { $divide: ["$probability", 100] }
                ]
              }
            }
          }
        }
      ]),

      FollowUp.countDocuments({
        ...followUpScope,
        status: "Pending"
      }),

      FollowUp.countDocuments({
        ...followUpScope,
        status: "Pending",
        dueDate: { $lt: now }
      }),

      FollowUp.countDocuments({
        ...followUpScope,
        status: "Completed"
      })
    ]);

    res.json({
      customers: {
        total: totalCustomers,
        active: activeCustomers
      },

      leads: {
        total: totalLeads,
        byStatus: Object.fromEntries(
          leadStatusCounts.map((item) => [item._id, item.count])
        )
      },

      opportunities: {
        total: totalOpportunities,
        byStage: Object.fromEntries(
          opportunityStageCounts.map((item) => [item._id, item.count])
        ),
        pipelineValue: activePipeline[0]?.totalValue || 0,
        weightedPipelineValue: activePipeline[0]?.weightedValue || 0
      },

      followUps: {
        pending: pendingFollowUps,
        overdue: overdueFollowUps,
        completed: completedFollowUps
      },

      generatedAt: now.toISOString()
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error.message);
    res.status(500).json({
      message: "Could not load dashboard statistics"
    });
  }
});

module.exports = router;
