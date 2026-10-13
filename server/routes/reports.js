
const express = require("express");
const { auth, allowRoles } = require("../middleware/auth");
const Opportunity = require("../models/Opportunity");
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const FollowUp = require("../models/FollowUp");

const router = express.Router();

function scoped(user) {
  if (["Admin", "Manager"].includes(user.role)) return {};
  return { $or: [{ createdBy: user.id }, { assignedTo: user.id }] };
}

// Consolidated authorized report data for dashboard/report consumers.
router.get("/overview", auth, async (req, res) => {
  try {
    const scope = scoped(req.user);
    const [customers, leads, followUps, opportunities] = await Promise.all([
      Customer.aggregate([{ $match: scope }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: scope }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      FollowUp.aggregate([{ $match: scope }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Opportunity.aggregate([{ $match: scope }, { $group: { _id: "$stage", count: { $sum: 1 }, amount: { $sum: "$amount" }, weightedAmount: { $sum: { $multiply: ["$amount", { $divide: ["$probability", 100] }] } } } }]),
    ]);
    res.json({ customers, leads, followUps, opportunities, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Overview report error:", error.message);
    res.status(500).json({ message: "Could not generate overview report" });
  }
});

router.get(
  "/pipeline",
  auth,
  allowRoles("Admin", "Manager"),
  async (req, res) => {
    try {
      const pipeline = await Opportunity.aggregate([
        {
          $group: {
            _id: "$stage",
            dealCount: { $sum: 1 },
            totalValue: {
              $sum: { $ifNull: ["$amount", 0] }
            },
            weightedValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$amount", 0] },
                  {
                    $divide: [
                      { $ifNull: ["$probability", 0] },
                      100
                    ]
                  }
                ]
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const activeStages = pipeline.filter(
        (stage) => !["Won", "Lost"].includes(stage._id)
      );

      const sum = (stages, field) =>
        stages.reduce((total, stage) => total + stage[field], 0);

      res.json({
        stages: pipeline,
        summary: {
          totalDeals: sum(pipeline, "dealCount"),
          activeDeals: sum(activeStages, "dealCount"),
          pipelineValue: sum(activeStages, "totalValue"),
          weightedPipelineValue: sum(activeStages, "weightedValue")
        }
      });
    } catch (error) {
      console.error("Pipeline report error:", error.message);

      res.status(500).json({
        message: "Could not generate pipeline report"
      });
    }
  }
);

module.exports = router;
