require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const linkedinRoutes = require("./routes/linkedin");

const app = express();

const PORT = process.env.PORT || 5000;

// ========================================
// MIDDLEWARE
// ========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ========================================
// HEALTH CHECK
// ========================================

app.get("/health", (req, res) => {

  res.status(200).json({
    success: true,
    message: "LinkedIn webhook service is running"
  });

});

// 2. New Route to Serve the Frontend HTML with the Meta JS SDK
app.get("/signup", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Meta SDK Setup</title>
    </head>
    <body>
        <h1>Meta SDK Integration Page</h1>

        <!-- Meta Frontend JavaScript SDK -->
        <script>
          window.fbAsyncInit = function() {
            FB.init({
              appId            : '1353462970255772', // Replace with your Meta App ID
              autoLogAppEvents : true,
              xfbml            : true,
              version          : 'v26.0'
            });
            console.log("Meta SDK successfully initialized in the browser!");
          };
        </script>
        <script async defer crossorigin="anonymous" src="https://facebook.net"></script>
    </body>
    </html>
  `);
});


// ========================================
// LINKEDIN ROUTES
// ========================================

console.log("Before calling linkedinRoutes");
app.use(
  "/api/v1/linkedin",
  linkedinRoutes
);
console.log("After calling linkedinRoutes");

// ========================================
// 404 HANDLER
// ========================================

app.use((req, res) => {

  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });

});


// ========================================
// MONGODB
// ========================================

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {

    console.log("MongoDB connected");

    app.listen(PORT, () => {

      console.log("");
      console.log("========================================");
      console.log("LINKEDIN WEBHOOK SERVICE STARTED");
      console.log("========================================");
      console.log(`Port: ${PORT}`);
      console.log(
        `Health: https://linkedin-webhook-service-1.onrender.com/health`
      );
      console.log(
        `Webhook: https://linkedin-webhook-service-1.onrender.com/api/v1/linkedin/webhook`
      );
      console.log(
        `Test: https://linkedin-webhook-service-1.onrender.com/api/v1/linkedin/webhook-test`
      );
      console.log("========================================");

    });

  })
  .catch((error) => {

    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);

  });
