const express = require("express");

// const {
//   validateWebhook,
//   receiveWebhook,
//   testLinkedInData,
//   testWebhook,
//   testLinkedInToken,
//   introspectLinkedInToken,
//   testLinkedInUserInfo,
//   testLinkedInMe,
//   getCompanyPosts,
//   testLinkedInUserInfoNative,
//   startLinkedInOAuth,
//   linkedInOAuthCallback,
//   debugStoredToken
// } = require("../controllers/linkedinWebhookController");

const {
  getCompanyPosts,
  startLinkedInOAuth,
  linkedInOAuthCallback,
} = require("../controllers/linkedinWebhookController");

const router = express.Router();

/*
 * LinkedIn webhook validation
 *
 * LinkedIn calls this with:
 *
 * GET /api/v1/linkedin/webhook?challengeCode=xxxxx
 */

// console.log("Before calling GET /webhook");
// router.get(
//   "/webhook",
//   validateWebhook
// );
// console.log("After calling GET /webhook");

/*
 * LinkedIn webhook events
 *
 * LinkedIn sends actual webhook events here.
 *
 * POST /api/v1/linkedin/webhook
 */
// console.log("Before calling post /webhook");
// router.post(
//   "/webhook",
//   receiveWebhook
// );
// console.log("After calling post /webhook");

// router.get(
//   "/test-data",
//   testLinkedInData
// );

// router.get(
//   "/linkedin/test-token",
//   testLinkedInToken
// );

// router.get(
//   "/introspect-token",
//   introspectLinkedInToken
// );

// router.get(
//   "/userinfo-test",
//   testLinkedInUserInfo
// );

// router.get(
//   "/me-test",
//   testLinkedInMe
// );

console.log("Before calling post /company-posts");
router.get(
  "/company-posts",
  getCompanyPosts
);
console.log("After calling post /company-posts");

// router.get(
//   "/test-userinfo-native",
//   testLinkedInUserInfoNative
// );

console.log("Before calling post /oauth/start");
router.get(
  "/oauth/start",
  startLinkedInOAuth
);
console.log("After calling post /oauth/start");

console.log("Before calling post /oauth/callback");
router.get(
  "/oauth/callback",
  linkedInOAuthCallback
);
console.log("After calling post /oauth/callback");

// router.get(
//   "/debug-token",
//   debugStoredToken
// );

// console.log("Before calling post /webhook-test");
// router.post("/webhook-test", testWebhook);
// console.log("After calling post /webhook-test");

module.exports = router;
