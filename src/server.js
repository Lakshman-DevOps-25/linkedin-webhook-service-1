require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const linkedinRouter = require("./routes/linkedin");

const app = express();

const PORT = process.env.PORT || 5000;

/*
 * Middleware
 */
app.use(express.json());

/*
 * Health check
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "linkedin-webhook-service",
    timestamp: new Date().toISOString()
  });
});

/*
 * LinkedIn routes
 */
app.use(
  "/api/v1/linkedin",
  linkedinRouter
);

/*
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl
  });
});

/*
 * MongoDB connection
 */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {

    console.log("========================================");
    console.log("MongoDB connected");
    console.log("========================================");

    app.listen(PORT, () => {

      console.log("========================================");
      console.log("LinkedIn Webhook Service");
      console.log("========================================");
      console.log(`Server running on port ${PORT}`);
      console.log(
        `Health: http://localhost:${PORT}/health`
      );
      console.log(
        `Webhook: http://localhost:${PORT}/api/v1/linkedin/webhook`
      );
      console.log("========================================");

    });
  })
  .catch((error) => {

    console.error(
      "MongoDB connection failed:"
    );

    console.error(
      error.message
    );

    process.exit(1);
  });