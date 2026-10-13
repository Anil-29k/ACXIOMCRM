
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 5002;
const CLIENT_URL = process.env.CLIENT_URL;

app.use(
  cors({
    origin: CLIENT_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", app: "AcxiomCRM API" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/leads", require("./routes/leads"));
app.use("/api/opportunities", require("./routes/opportunities"));
app.use("/api/followups", require("./routes/followups"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/activities", require("./routes/activities"));
app.use("/api/audit-logs", require("./routes/auditLogs"));

async function start() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from .env");
    }

    if (!CLIENT_URL) {
      throw new Error("CLIENT_URL is missing from .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`AcxiomCRM API running on http://localhost:${PORT}`);
      console.log(`Allowed frontend origin: ${CLIENT_URL}`);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

start();
