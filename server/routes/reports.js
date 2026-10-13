
const express = require("express");
const { auth, allowRoles } = require("../middleware/auth");
const Opportunity = require("../models/Opportunity");

const router = express.Router();

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
