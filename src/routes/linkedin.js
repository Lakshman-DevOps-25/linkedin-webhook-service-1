const express = require("express");

const {
  validateWebhook,
  receiveWebhook
} = require("../controllers/linkedinWebhookController");

const router = express.Router();

// LinkedIn validation
router.get("/webhook", validateWebhook);

// LinkedIn webhook notifications
router.post("/webhook", receiveWebhook);

module.exports = router;