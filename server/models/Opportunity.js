
const mongoose = require("mongoose");

const opportunitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Opportunity name is required"],
      trim: true,
      maxlength: 150,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },

    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"],
      default: 0,
    },

    stage: {
      type: String,
      enum: [
        "Qualification",
        "Needs Analysis",
        "Proposal",
        "Negotiation",
        "Won",
        "Lost",
      ],
      default: "Qualification",
    },

    probability: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },

    expectedCloseDate: {
      type: Date,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

opportunitySchema.index({ stage: 1 });
opportunitySchema.index({ assignedTo: 1 });
opportunitySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Opportunity", opportunitySchema);
