const express = require("express");

const {
  validateWebhook,
  receiveWebhook,
  testLinkedInData,
  testWebhook
} = require("../controllers/linkedinWebhookController");

const router = express.Router();

/*
 * LinkedIn webhook validation
 *
 * LinkedIn calls this with:
 *
 * GET /api/v1/linkedin/webhook?challengeCode=xxxxx
 */

console.log("Before calling GET /webhook");
router.get(
  "/webhook",
  validateWebhook
);
console.log("After calling GET /webhook");

/*
 * LinkedIn webhook events
 *
 * LinkedIn sends actual webhook events here.
 *
 * POST /api/v1/linkedin/webhook
 */
console.log("Before calling post /webhook");
router.post(
  "/webhook",
  receiveWebhook
);
console.log("After calling post /webhook");

router.get(
  "/test-data",
  testLinkedInData
);

router.get(
  "/linkedin/test-token",
  testLinkedInToken
);

console.log("Before calling post /webhook-test");
router.post("/webhook-test", testWebhook);
console.log("After calling post /webhook-test");

module.exports = router;
