const express = require("express");

const {
  validateWebhook,
  receiveWebhook
} = require("../controllers/linkedinWebhookController");

const router = express.Router();

/*
 * LinkedIn webhook validation
 *
 * LinkedIn calls this with:
 *
 * GET /api/v1/linkedin/webhook?challengeCode=xxxxx
 */
router.get(
  "/webhook",
  validateWebhook
);

/*
 * LinkedIn webhook events
 *
 * LinkedIn sends actual webhook events here.
 *
 * POST /api/v1/linkedin/webhook
 */
router.post(
  "/webhook",
  receiveWebhook
);

module.exports = router;