require("dotenv").config();

const express = require("express");
const linkedinRouter = require("./routes/linkedin");

const app = express();

const PORT = process.env.PORT || 5000;

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "linkedin-webhook-service",
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// LinkedIn webhook routes
// --------------------------------------------------

app.use("/api/v1/linkedin", linkedinRouter);

// --------------------------------------------------
// 404 handler
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    method: req.method,
    path: req.originalUrl
  });
});

// --------------------------------------------------
// Global error handler
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR");
  console.error(err);

  res.status(500).json({
    error: "Internal server error"
  });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log("========================================");
  console.log("LinkedIn Webhook Service");
  console.log("========================================");
  console.log(`Server running on port ${PORT}`);
  console.log(`Health: /health`);
  console.log(
    `Webhook: /api/v1/linkedin/webhook`
  );
  console.log("========================================");
});