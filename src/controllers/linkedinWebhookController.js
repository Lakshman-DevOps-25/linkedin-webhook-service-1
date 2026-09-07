// require('dotenv').config();

const crypto = require("crypto");
const axios = require("axios");

const LinkedInData = require("../models/LinkedInData");
/*
|--------------------------------------------------------------------------
| LinkedIn API Configuration
|--------------------------------------------------------------------------
*/
const LINKEDIN_API = "https://api.linkedin.com/rest";
const LINKEDIN_VERSION = "202608";

/*
|--------------------------------------------------------------------------
| Common LinkedIn Headers
|--------------------------------------------------------------------------
*/
/*
const getLinkedInHeaders = () => {

  const token = process.env.LINKEDIN_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "LINKEDIN_ACCESS_TOKEN is missing"
    );
  }

  return {
    Authorization: `Bearer ${token.trim()}`,

    "X-Restli-Protocol-Version":
      "2.0.0",

    "LinkedIn-Version":
      "202608",

    "Content-Type":
      "application/json"
  };
};
*/

const getLinkedInHeaders = () => {
  const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();

  console.log("========================================");
  console.log("LINKEDIN TOKEN DEBUG");
  console.log("========================================");
  console.log("Token exists:", !!token);
  console.log("Token length:", token ? token.length : 0);

  if (token) {
    console.log(
      "Token fingerprint:",
      crypto
        .createHash("sha256")
        .update(token)
        .digest("hex")
        .substring(0, 16)
    );
  }

  console.log("========================================");

  if (!token) {
    throw new Error("LINKEDIN_ACCESS_TOKEN is missing");
  }

  const checkToken = "AQX9nMUN9mu0a7o3CWnLJdQ6Jy_1P9vx77t-BZYwDvH5t62Ed4N7Uc_6OCu3NiNxvIIucNRNEXjuZViPPMY_6-JrBYD1FXPEoDdha2ry0BtrlNCwP8IoZUSqYc_YAHiX91qZ5g-Q4HsWfgKPhu6OrPQpky7mgHfd0Nne0mrRyEhPFjuTgV3GA2rPOQIIvRPSQFF57Wpvz-KLkmr5vaDa4AsqNWDegE8ORlP-SGTRkQnh_bdDQE8gVqB_DZXz3ZOF5EpGUUI4dlhFaed9ytUH41xk5Q3cWNAoe7TBAXhXej0cJiKtRRkSa2gIRFwit-w27SX-ZS-32V3pDXsO-wGXlPT7d-jk7g";

  console.log("Calculate the SHA-256 fingerprint of the token: ", 
    crypto
      .createHash("sha256")
      .update(checkToken.trim())
      .digest("hex")
      .substring(0, 16)
  );

  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": "202608",
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json"
  };
};

/*
|--------------------------------------------------------------------------
| 1. LinkedIn Webhook Validation
|--------------------------------------------------------------------------
|
| LinkedIn sends:
|
| GET /api/v1/linkedin/webhook?challengeCode=xxxxx
|
| We MUST respond immediately.
|
|--------------------------------------------------------------------------
*/

const validateWebhook = (req, res) => {
  try {
    console.log("");
    console.log("========================================");
    console.log("LINKEDIN WEBHOOK VALIDATION");
    console.log("========================================");
    console.log( "Query:", req.query);

    console.log("LINKEDIN_CLIENT_SECRET :", process.env.LINKEDIN_CLIENT_SECRET);

    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientSecret) {
      console.error(
        "LINKEDIN_CLIENT_SECRET is missing"
      );

      return res.status(500).json({
        success: false,
        error:
          "LINKEDIN_CLIENT_SECRET is not configured"
      });
    }


    /*
     * LinkedIn sends challengeCode as a query parameter.
     *
     * Normalize it in case Express receives an array.
     */

    // const rawChallengeCode = req.query.challengeCode;
    // const challengeCode = Array.isArray(rawChallengeCode) ? rawChallengeCode[0] : rawChallengeCode;

    // if (!challengeCode) {
    //   console.error("challengeCode is missing");
    //   return res.status(400).json({
    //     success: false,
    //     error: "Missing challengeCode"
    //   });
    // }
    // console.log("challengeCode:", challengeCode);

    // /*
    //  * Generate HMAC SHA256.
    //  */
    // const challengeResponse = crypto.createHmac("sha256",clientSecret).update(String(challengeCode),"utf8").digest("hex");

    // console.log("challengeResponse:",challengeResponse);
    // console.log("Returning HTTP 200");
    // console.log("========================================");

    // /*
    //  * IMPORTANT:
    //  *
    //  * Do NOT call LinkedIn organization/posts/comments
    //  * APIs here.
    //  *
    //  * This request must finish quickly.
    //  */
    // return res.status(200).json({
    //   challengeCode,
    //   challengeResponse
    // });

    return true;
  } catch (error) {
    console.error("Webhook validation error:",error.message);

    return res.status(500).json({
      success: false,
      error: "Webhook validation failed"
    });
  }
};

/*
|--------------------------------------------------------------------------
| 2. Receive LinkedIn Webhook Event
|--------------------------------------------------------------------------
|
| LinkedIn sends actual events using POST.
|
|--------------------------------------------------------------------------
*/
// const crypto = require("crypto");
// const LinkedInData = require("../models/LinkedInData");

const receiveWebhook = async (req, res) => {
  const startTime = Date.now();

  console.log("");
  console.log("========================================");
  console.log("LINKEDIN WEBHOOK EVENT RECEIVED");
  console.log("========================================");

  try {
    // =========================================================
    // 1. REQUEST INFORMATION
    // =========================================================

    console.log("Timestamp:", new Date().toISOString());
    console.log("Method:", req.method);
    console.log("URL:", req.originalUrl);
    console.log("IP:", req.ip);

    console.log("----------------------------------------");
    console.log("HEADERS");
    console.log("----------------------------------------");

    console.log("Content-Type:", req.headers["content-type"]);
    console.log("X-LI-Signature:", req.headers["x-li-signature"]);
    console.log("User-Agent:", req.headers["user-agent"]);


    // =========================================================
    // 2. GET RAW BODY
    // =========================================================

    if (!req.body) {
      console.error("ERROR: Request body is missing");

      return res.status(400).json({
        success: false,
        message: "Request body is missing"
      });
    }

    let rawBody;

    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === "string") {
      rawBody = Buffer.from(req.body, "utf8");
    } else {
      console.error(
        "ERROR: Request body is not a Buffer or string"
      );

      console.error(
        "Body type:",
        typeof req.body
      );

      return res.status(400).json({
        success: false,
        message: "Invalid raw request body"
      });
    }


    console.log("----------------------------------------");
    console.log("RAW BODY");
    console.log("----------------------------------------");

    console.log(rawBody.toString("utf8"));


    // =========================================================
    // 3. GET LINKEDIN SIGNATURE
    // =========================================================

    const receivedSignature =
      req.headers["x-li-signature"];

    if (!receivedSignature) {
      console.error(
        "ERROR: X-LI-Signature header is missing"
      );

      return res.status(401).json({
        success: false,
        message: "Missing X-LI-Signature header"
      });
    }


    // =========================================================
    // 4. GET CLIENT SECRET
    // =========================================================

    const clientSecret =
      process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientSecret) {
      console.error(
        "ERROR: LINKEDIN_CLIENT_SECRET is not configured"
      );

      return res.status(500).json({
        success: false,
        message: "LinkedIn client secret is not configured"
      });
    }


    // =========================================================
    // 5. CALCULATE EXPECTED SIGNATURE
    // =========================================================

    const expectedSignature =
      crypto
        .createHmac("sha256", clientSecret)
        .update(rawBody)
        .digest("hex");


    console.log("----------------------------------------");
    console.log("SIGNATURE VALIDATION");
    console.log("----------------------------------------");

    console.log(
      "Received signature:",
      receivedSignature
    );

    console.log(
      "Expected signature:",
      expectedSignature
    );


    // =========================================================
    // 6. NORMALIZE RECEIVED SIGNATURE
    // =========================================================

    let normalizedSignature =
      receivedSignature.trim();

    if (
      normalizedSignature
        .toLowerCase()
        .startsWith("sha256=")
    ) {
      normalizedSignature =
        normalizedSignature
          .substring(7)
          .trim();
    }


    // =========================================================
    // 7. COMPARE SIGNATURES
    // =========================================================

    let signatureValid = false;

    try {
      const expectedBuffer =
        Buffer.from(
          expectedSignature,
          "hex"
        );

      const receivedBuffer =
        Buffer.from(
          normalizedSignature,
          "hex"
        );

      if (
        expectedBuffer.length ===
        receivedBuffer.length
      ) {
        signatureValid =
          crypto.timingSafeEqual(
            expectedBuffer,
            receivedBuffer
          );
      }
    } catch (signatureError) {
      console.error(
        "Signature comparison error:",
        signatureError
      );

      signatureValid = false;
    }


    console.log(
      "Signature valid:",
      signatureValid
    );


    // =========================================================
    // 8. REJECT INVALID SIGNATURE
    // =========================================================

    if (!signatureValid) {
      console.error("");
      console.error(
        "========================================"
      );
      console.error(
        "LINKEDIN SIGNATURE VALIDATION FAILED"
      );
      console.error(
        "========================================"
      );

      return res.status(401).json({
        success: false,
        message: "Invalid LinkedIn webhook signature"
      });
    }


    console.log(
      "LinkedIn signature validation SUCCESS"
    );


    // =========================================================
    // 9. PARSE JSON
    // =========================================================

    let payload;

    try {
      payload = JSON.parse(
        rawBody.toString("utf8")
      );
    } catch (parseError) {
      console.error(
        "ERROR: Invalid JSON payload"
      );

      console.error(parseError);

      return res.status(400).json({
        success: false,
        message: "Invalid JSON payload"
      });
    }


    // =========================================================
    // 10. LOG PAYLOAD
    // =========================================================

    console.log("----------------------------------------");
    console.log("PARSED LINKEDIN PAYLOAD");
    console.log("----------------------------------------");

    console.log(
      JSON.stringify(
        payload,
        null,
        2
      )
    );


    // =========================================================
    // 11. GET EVENT TYPE
    // =========================================================

    const eventType =
      payload.type || null;

    console.log(
      "Event type:",
      eventType
    );


    // =========================================================
    // 12. GET NOTIFICATIONS
    // =========================================================

    const notifications =
      Array.isArray(payload.notifications)
        ? payload.notifications
        : [];

    console.log(
      "Notification count:",
      notifications.length
    );


    // =========================================================
    // 13. PROCESS NOTIFICATIONS
    // =========================================================

    for (const notification of notifications) {

      console.log("");
      console.log(
        "----------------------------------------"
      );

      console.log(
        "PROCESSING LINKEDIN NOTIFICATION"
      );

      console.log(
        "----------------------------------------"
      );

      console.log(
        JSON.stringify(
          notification,
          null,
          2
        )
      );


      // -------------------------------------------------------
      // Extract notification ID
      // -------------------------------------------------------

      const notificationId =
        notification.notificationId
          ? String(notification.notificationId)
          : null;


      // -------------------------------------------------------
      // Extract action
      // -------------------------------------------------------

      const action =
        notification.action || null;


      console.log(
        "notificationId:",
        notificationId
      );

      console.log(
        "action:",
        action
      );


      // -------------------------------------------------------
      // Determine LinkedIn ID
      // -------------------------------------------------------

      /*
       * Prefer an actual LinkedIn entity/post/comment ID
       * when it is available.
       *
       * Otherwise use notificationId temporarily.
       *
       * This allows the webhook to be stored even when
       * LinkedIn sends only a notification identifier.
       */

      const linkedinId =
        notification.postId
          ? String(notification.postId)
          : notification.commentId
            ? String(notification.commentId)
            : notificationId;


      if (!linkedinId) {

        console.warn(
          "WARNING: No LinkedIn ID found in notification"
        );

        continue;
      }


      // -------------------------------------------------------
      // Determine data type
      // -------------------------------------------------------

      let dataType = "post";

      if (notification.commentId) {
        dataType = "comment";
      }


      // -------------------------------------------------------
      // Organization information
      // -------------------------------------------------------

      const organizationId =
        notification.organizationId
          ? String(notification.organizationId)
          : null;

      const organizationUrn =
        notification.organizationUrn ||
        null;


      // -------------------------------------------------------
      // Create LinkedInData document
      // -------------------------------------------------------

      const data = {
        type: dataType,

        linkedinId: linkedinId,

        organizationId: organizationId,

        organizationUrn: organizationUrn,

        organizationName:
          notification.organizationName ||
          null,

        postId:
          notification.postId
            ? String(notification.postId)
            : null,

        author:
          notification.author ||
          null,

        text:
          notification.text ||
          "",

        createdAtLinkedIn:
          notification.createdAt
            ? new Date(notification.createdAt)
            : null,

        rawData: {
          eventType: eventType,
          action: action,
          notification: notification
        }
      };


      // -------------------------------------------------------
      // Save / Update MongoDB
      // -------------------------------------------------------

      const savedData =
        await LinkedInData.findOneAndUpdate(
          {
            linkedinId: linkedinId
          },
          {
            $set: data
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
          }
        );


      console.log(
        "LinkedIn data saved successfully"
      );

      console.log(
        "MongoDB ID:",
        savedData._id
      );

      console.log(
        "LinkedIn ID:",
        savedData.linkedinId
      );
    }


    // =========================================================
    // 14. PROCESSING TIME
    // =========================================================

    const processingTime =
      Date.now() - startTime;

    console.log("");
    console.log(
      "Processing time:",
      processingTime,
      "ms"
    );


    // =========================================================
    // 15. RETURN HTTP 200
    // =========================================================

    console.log(
      "Returning HTTP 200 to LinkedIn"
    );

    console.log(
      "========================================"
    );

    console.log(
      "LINKEDIN WEBHOOK PROCESSING COMPLETE"
    );

    console.log(
      "========================================"
    );

    return res.status(200).json({
      success: true,
      message: "LinkedIn webhook received successfully",
      eventType: eventType,
      notificationCount: notifications.length
    });

  } catch (error) {

    console.error("");
    console.error(
      "========================================"
    );

    console.error(
      "LINKEDIN WEBHOOK PROCESSING ERROR"
    );

    console.error(
      "========================================"
    );

    console.error(
      "Error:",
      error.message
    );

    console.error(
      "Stack:",
      error.stack
    );

    console.error(
      "Processing time:",
      Date.now() - startTime,
      "ms"
    );

    console.error(
      "========================================"
    );

    /*
     * Important:
     *
     * If an internal error occurs, return 500 so LinkedIn
     * knows the notification was not successfully processed.
     */

    return res.status(500).json({
      success: false,
      message: "Internal server error while processing LinkedIn webhook"
    });
  }
};


/*
|--------------------------------------------------------------------------
| 3. Get Organization ID
|--------------------------------------------------------------------------
|
| Automatically discover organizations associated with
| the authenticated LinkedIn user.
|
| NO company URL is required.
|
|--------------------------------------------------------------------------
*/
/*
const getOrganizationId = async () => {

  console.log("STEP 1: Getting organization access...");

  try {

    const response = await axios.get(
      `${LINKEDIN_API}/organizationAcls`,
      {
        params: {
          q: "roleAssignee",
          role: "ADMINISTRATOR",
          state: "APPROVED"
        },

        headers: getLinkedInHeaders(),

        validateStatus: () => true
      }
    );

    console.log(
      "LinkedIn organizationAcls status:",
      response.status
    );

    console.log(
      "LinkedIn organizationAcls response:",
      JSON.stringify(
        response.data,
        null,
        2
      )
    );

    if (response.status >= 400) {

      throw new Error(
        `organizationAcls failed with HTTP ${response.status}: ` +
        JSON.stringify(response.data)
      );

    }

    const elements =
      response.data?.elements || [];

    if (!elements.length) {

      throw new Error(
        "No approved LinkedIn organizations found for this user."
      );

    }

    const organization =
      elements[0];

    console.log(
      "Organization ACL:",
      JSON.stringify(
        organization,
        null,
        2
      )
    );

    /*
     * Depending on the response, organization URN
     * can be available in organization field.
     
    const organizationUrn =
      organization.organization ||
      organization.organizationalEntity;

    if (!organizationUrn) {

      throw new Error(
        "Organization URN not found in organizationAcls response."
      );

    }

    const organizationId =
      organizationUrn.split(":").pop();

    console.log(
      "Organization ID:",
      organizationId
    );

    return {
      organizationId,
      organizationUrn
    };

  } catch (error) {

    console.error(
      "getOrganizationId() failed:"
    );

    console.error(
      error.response?.status
    );

    console.error(
      JSON.stringify(
        error.response?.data,
        null,
        2
      )
    );

    console.error(
      error.message
    );

    throw error;
  }
};
*/

const getOrganizationId = async () => {

  console.log("");
  console.log("========================================");
  console.log("STEP 1: Getting organization access...");
  console.log("========================================");


  try {
    const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();

    // ------------------------------------
    // TOKEN CHECK
    // ------------------------------------

    if (!token) {
      throw new Error("LINKEDIN_ACCESS_TOKEN is missing from environment variables");
    }

    console.log("LinkedIn token exists:",true);
    console.log("LinkedIn token length:",token.length);
    console.log("LinkedIn token prefix:",token.substring(0, 8) + "...");

    // ------------------------------------
    // API URL
    // ------------------------------------

    const apiUrl = `${LINKEDIN_API}/organizationAcls`;
    console.log("LinkedIn organizationAcls URL:",apiUrl);


    // ------------------------------------
    // API CALL
    // ------------------------------------

    const response = await axios.get(
      apiUrl,
      {
        params: {
          q: "roleAssignee",
          role: "ADMINISTRATOR",
          state: "APPROVED"
        },
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": "202608",
          "Content-Type": "application/json"
        },
        validateStatus: () => true
      }
    );

    console.log("LinkedIn organizationAcls status:",response.status);
    console.log("LinkedIn organizationAcls response:",JSON.stringify(response.data,null,2));

    // ------------------------------------
    // ERROR
    // ------------------------------------

    if (response.status >= 400) {
      throw new Error(`organizationAcls failed with HTTP ${response.status}: ` + JSON.stringify(response.data));
    }

    // ------------------------------------
    // RESPONSE
    // ------------------------------------

    const elements = response.data?.elements || [];

    if (!elements.length) {
      throw new Error("No approved LinkedIn organizations found for this user.");
    }
    console.log("Organizations found:",elements.length);

    // ------------------------------------
    // FIND ADMIN ORGANIZATION
    // ------------------------------------

    const organization = elements.find(element => element.role === "ADMINISTRATOR" && element.state ==="APPROVED") || elements[0];
    console.log("Organization ACL:",JSON.stringify(organization,null,2));

    // ------------------------------------
    // GET ORGANIZATION URN
    // ------------------------------------

    const organizationUrn = organization.organization || organization.organizationalTarget || organization.organizationTarget;

    if (!organizationUrn) {
        throw new Error("Organization URN not found in organizationAcls response.");
    }


    // ------------------------------------
    // ORGANIZATION ID
    // ------------------------------------

    const organizationId = organizationUrn.split(":").pop();
    console.log("Organization URN:",organizationUrn);
    console.log("Organization ID:",organizationId);
    return {organizationId,organizationUrn};

  } catch (error) {

    console.error("");
    console.error("========================================");
    console.error("getOrganizationId() FAILED");
    console.error("========================================");
    console.error(
      "Error message:",
      error.message
    );

    if (error.response) {
      console.error("HTTP status:",error.response.status);
      console.error("LinkedIn response:",JSON.stringify(error.response.data,null,2));
    }
    console.error("========================================");
    throw error;
  }

};

/*
|--------------------------------------------------------------------------
| 4. Get Organization Details
|--------------------------------------------------------------------------
*/

const getOrganization = async (organizationId) => {
  console.log("");
  console.log("STEP 2: Getting organization details...");

  const response =
    await axios.get(`${LINKEDIN_API}/organizations/${organizationId}`,
      { headers: getLinkedInHeaders() }
    );

  console.log("Organization:", JSON.stringify( response.data, null, 2)
  );

  return response.data;
};


/*
|--------------------------------------------------------------------------
| 5. Save Organization
|--------------------------------------------------------------------------
*/

const saveOrganization = async (organization, organizationId, organizationUrn) => {

  await LinkedInData.findOneAndUpdate(
    {
      linkedinId: organizationUrn
    },
    {
      type: "organization",
      linkedinId: organizationUrn,
      organizationId,
      organizationUrn,
      organizationName: organization.localizedName || "",
      rawData: organization
    },
    {
      upsert: true,
      new: true
    }
  );
};


/*
|--------------------------------------------------------------------------
| 6. Get Organization Posts
|--------------------------------------------------------------------------
*/
/*
const getPosts = async (organizationUrn) => {
  console.log("");
  console.log("STEP 3: Getting organization posts...");

  const response =
    await axios.get(`${LINKEDIN_API}/posts`,{
        params: {
          q: "author",
          author: organizationUrn
        },
        headers: getLinkedInHeaders()
      }
    );


  const posts = response.data?.elements || [];
  console.log("Posts received:",posts.length);
  return posts;
};
*/

const getPosts = async (organizationUrn) => {

  console.log("");
  console.log("========================================");
  console.log("STEP 3: Getting organization posts...");
  console.log("========================================");

  console.log("Organization URN:", organizationUrn);

  try {
    const response = await axios.get(
      `${LINKEDIN_API}/posts`,
      {
        params: {
          q: "author",
          author: organizationUrn,
          count: 100,
          sortBy: "CREATED"
        },

        headers: {
          ...getLinkedInHeaders(),
          "X-RestLi-Method": "FINDER"
        }
      }
    );

    const posts = response.data?.elements || [];

    console.log("Posts received:", posts.length);

    return posts;

  } catch (error) {
    console.error("GET POSTS ERROR:", JSON.stringify(error.response?.data, null, 2));
    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| 7. Save Post
|--------------------------------------------------------------------------
*/
const savePost = async (post,organizationId,organizationUrn,organizationName) => {
  const postId = post.id;
  if (!postId) {
    console.warn("Post does not contain ID");
    return;
  }

  /*
   * Current Posts API can contain
   * commentary under the post object.
   */

  const text = post.commentary || post.specificContent ?.com.linkedin.ugc.ShareContent ?.shareCommentary ?.text || "";

  /*
   * Convert LinkedIn timestamp to Date
   * if available.
   */
  let createdAtLinkedIn = null;
  
  if (post.createdAt) { 
    createdAtLinkedIn = new Date( post.createdAt);
  } else if (
    post.created?.time
  ) {
    createdAtLinkedIn = new Date( post.created.time );
  }

  await LinkedInData.findOneAndUpdate(
    {
      linkedinId: postId
    },
    {
      type: "post",
      linkedinId: postId,
      organizationId,
      organizationUrn,
      organizationName,
      postId,
      text,
      createdAtLinkedIn,
      rawData: post
    },
    {
      upsert: true,
      new: true
    }
  );
};


/*
|--------------------------------------------------------------------------
| 8. Get Comments
|--------------------------------------------------------------------------
*/

const getComments = async ( postId ) => {

  console.log( "Getting comments for:", postId);

  const response = await axios.get(
      `${LINKEDIN_API}/socialActions/${encodeURIComponent(postId)}/comments`,
      {
        headers: getLinkedInHeaders()
      }
    );

  const comments = response.data?.elements || [];
  console.log("Comments received:", comments.length);
  return comments;
};


/*
|--------------------------------------------------------------------------
| 9. Save Comment
|--------------------------------------------------------------------------
*/
const saveComment = async (comment, postId, organizationId, organizationUrn, organizationName) => {

  const commentId = comment.commentUrn || comment.id;

  if (!commentId) {
    console.warn("Comment does not contain ID");
    return;
  }

  const text = comment.message?.text || "";
  let createdAtLinkedIn = null;

  if ( comment.created?.time) {
    createdAtLinkedIn = new Date(comment.created.time);
  }

  await LinkedInData.findOneAndUpdate(
    {linkedinId: commentId},
    {
      type: "comment",
      linkedinId: commentId,
      organizationId,
      organizationUrn,
      organizationName,
      postId,
      author: comment.actor || null,
      text,
      createdAtLinkedIn,
      rawData: comment
    },
    {
      upsert: true,
      new: true
    }
  );
};


/*
|--------------------------------------------------------------------------
| 10. Main LinkedIn Processing
|--------------------------------------------------------------------------
|
| Organization
|      ↓
| Organization ID
|      ↓
| Organization Details
|      ↓
| Posts
|      ↓
| Comments
|      ↓
| MongoDB
|
|--------------------------------------------------------------------------
*/

const processLinkedInData =
  async (req, res) => {
    console.log("");
    console.log("========================================");
    console.log("STARTING LINKEDIN DATA PROCESSING");
    console.log("========================================");

    /*
     * Check access token.
     */

    console.log("Checking LinkedIn access token...", process.env.LINKEDIN_ACCESS_TOKEN);
    if (!process.env.LINKEDIN_ACCESS_TOKEN) {
      throw new Error("LINKEDIN_ACCESS_TOKEN is missing");
    }

    /*
     * STEP 1
     *
     * Get organization ID automatically.
     */

    // const {organizationId, organizationUrn} = await getOrganizationId();

    const notification = req.body?.notifications?.[0];

    console.log("Notification received:", JSON.stringify(notification, null, 2));

    const organizationUrn = notification?.organizationalEntity;

    if (!organizationUrn) {
        throw new Error("organizationalEntity missing from webhook");
    }

    const organizationId = organizationUrn.split(":").pop();

    console.log("Organization URN:", organizationUrn);

    console.log("Organization ID:", organizationId);

    /*
     * STEP 2
     *
     * Get organization information.
     */

    const organization = await getOrganization( organizationId);
    const organizationName = organization.localizedName || organization.vanityName || "";

    /*
     * Save organization.
     */
    await saveOrganization(organization, organizationId, organizationUrn);


    /*
     * STEP 3
     *
     * Get organization posts.
     */

    const posts = await getPosts(organizationUrn);
    let postsSaved = 0;
    let commentsSaved = 0;

    /*
     * STEP 4
     *
     * Save posts and comments.
     */

    for ( const post of posts ) {
      try {
        /*
         * Save post.
         */
        await savePost( post, organizationId,  organizationUrn, organizationName);
        postsSaved++;
        /*
         * Get comments.
         */
        const postId = post.id;
        if (!postId) {
          continue;
        }

        const comments = await getComments(postId);

        /*
         * Save comments.
         */

        for (const comment of comments) {
          await saveComment(
            comment,
            postId,
            organizationId,
            organizationUrn,
            organizationName
          );
          commentsSaved++;
        }

      } catch (postError) {
        console.error(`Post processing failed for ${post.id}:`);
        console.error(postError.response?.data || postError.message);
      }
    }

    console.log("");
    console.log("========================================");
    console.log("LINKEDIN DATA PROCESSING COMPLETE");
    console.log("Organization ID:", organizationId);
    console.log("Posts saved:", postsSaved);
    console.log("Comments saved:", commentsSaved);
    console.log("========================================");
  };


  const   testLinkedInData = async (req, res) => {

  console.log("");
  console.log("========================================");
  console.log("MANUAL LINKEDIN DATA TEST");
  console.log("========================================");

  try {

    const organizationUrn = req.query.organizationUrn;

    if (!organizationUrn) {
      return res.status(400).json({
        success: false,
        message: "organizationUrn query parameter is required",
        example:
          "/api/v1/linkedin/test-data?organizationUrn=urn:li:organization:112423016"
      });
    }

    if (!organizationUrn.startsWith("urn:li:organization:")) {
      return res.status(400).json({
        success: false,
        message: "Invalid LinkedIn organization URN"
      });
    }

    const organizationId = organizationUrn.split(":").pop();

    console.log("Organization URN:", organizationUrn);
    console.log("Organization ID:", organizationId);

    /*
     * STEP 1
     * Get organization details
     */

    const organization = await getOrganization(organizationId);

    const organizationName = organization.localizedName || organization.vanityName || "";

    /*
     * STEP 2
     * Save organization
     */

    await saveOrganization(
      organization,
      organizationId,
      organizationUrn
    );

    /*
     * STEP 3
     * Get posts
     */

    const posts =
      await getPosts(organizationUrn);

    let postsSaved = 0;
    let commentsSaved = 0;

    /*
     * STEP 4
     * Save posts and comments
     */

    for (const post of posts) {

      try {

        await savePost(
          post,
          organizationId,
          organizationUrn,
          organizationName
        );

        postsSaved++;

        const postId = post.id;

        if (!postId) {
          continue;
        }

        /*
         * Get comments
         */

        const comments =
          await getComments(postId);

        /*
         * Save comments
         */

        for (const comment of comments) {

          await saveComment(
            comment,
            postId,
            organizationId,
            organizationUrn,
            organizationName
          );

          commentsSaved++;
        }

      } catch (postError) {

        console.error(
          `Post processing failed for ${post.id}:`
        );

        console.error(
          postError.response?.data ||
          postError.message
        );
      }
    }

    console.log("");
    console.log("========================================");
    console.log("MANUAL LINKEDIN DATA TEST COMPLETE");
    console.log("========================================");

    console.log(
      "Organization ID:",
      organizationId
    );

    console.log(
      "Posts received:",
      posts.length
    );

    console.log(
      "Posts saved:",
      postsSaved
    );

    console.log(
      "Comments saved:",
      commentsSaved
    );

    console.log("========================================");

    return res.status(200).json({
      success: true,
      message: "LinkedIn data processing completed",
      organizationId,
      organizationUrn,
      organizationName,
      postsReceived: posts.length,
      postsSaved,
      commentsSaved
    });

  } catch (error) {

    console.error("");
    console.error("========================================");
    console.error("MANUAL LINKEDIN DATA TEST FAILED");
    console.error("========================================");

    console.error(
      error.response?.data ||
      error.message
    );

    console.error("========================================");

    return res.status(500).json({
      success: false,
      message: "LinkedIn data processing failed",
      error:
        error.response?.data ||
        error.message
    });
  }
};


const testWebhook = async (req, res) => {

  console.log("");
  console.log("========================================");
  console.log("TEST WEBHOOK RECEIVED");
  console.log("========================================");

  console.log("Method:", req.method);

  console.log(
    "Headers:",
    JSON.stringify(req.headers, null, 2)
  );

  console.log(
    "Body:",
    JSON.stringify(req.body, null, 2)
  );

  console.log("========================================");

  return res.status(200).json({
    success: true,
    message: "Test webhook received successfully",
    received: true
  });
};

const testLinkedInToken = async (req, res) => {
  try {
    const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
    console.log("Testing LinkedIn token:", token);

    console.log("Render Client ID:", process.env.LINKEDIN_CLIENT_ID?.trim());
    console.log("Render Client SECRET:", process.env.LINKEDIN_CLIENT_SECRET?.trim());

    const response = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer AQX9nMUN9mu0a7o3CWnLJdQ6Jy_1P9vx77t-BZYwDvH5t62Ed4N7Uc_6OCu3NiNxvIIucNRNEXjuZViPPMY_6-JrBYD1FXPEoDdha2ry0BtrlNCwP8IoZUSqYc_YAHiX91qZ5g-Q4HsWfgKPhu6OrPQpky7mgHfd0Nne0mrRyEhPFjuTgV3GA2rPOQIIvRPSQFF57Wpvz-KLkmr5vaDa4AsqNWDegE8ORlP-SGTRkQnh_bdDQE8gVqB_DZXz3ZOF5EpGUUI4dlhFaed9ytUH41xk5Q3cWNAoe7TBAXhXej0cJiKtRRkSa2gIRFwit-w27SX-ZS-32V3pDXsO-wGXlPT7d-jk7g`
        },
        validateStatus: () => true
      }
    );

    console.log("LinkedIn userinfo status:", response.status);
    console.log("LinkedIn response:", response.data);

    return res.status(200).json({
      status: response.status,
      data: response.data
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
};

const introspectLinkedInToken = async (req, res) => {
  console.log("========================================");
  console.log("LINKEDIN TOKEN INTROSPECTION");
  console.log("========================================");

  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN?.trim();

    console.log("Client ID exists:", !!clientId);
    console.log("Client Secret exists:", !!clientSecret);
    console.log("Access Token exists:", !!accessToken);

    if (!clientId) {
      return res.status(500).json({
        success: false,
        error: "LINKEDIN_CLIENT_ID is missing"
      });
    }

    if (!clientSecret) {
      return res.status(500).json({
        success: false,
        error: "LINKEDIN_CLIENT_SECRET is missing"
      });
    }

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        error: "LINKEDIN_ACCESS_TOKEN is missing"
      });
    }

    // Do NOT log the actual token
    console.log("Token length:", accessToken.length);

    const tokenFingerprint = crypto
      .createHash("sha256")
      .update(accessToken)
      .digest("hex")
      .substring(0, 16);

    console.log("Token fingerprint:", tokenFingerprint);

    const params = new URLSearchParams();

    console.log("Introspecting LinkedIn token from introspectLinkedInToken function ...");
    console.log("params:", params.toString());

    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);
    params.append("token", accessToken);

    const response = await axios.post(
      "https://www.linkedin.com/oauth/v2/introspectToken",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("========================================");
    console.log("LINKEDIN TOKEN INTROSPECTION RESULT");
    console.log("========================================");

    console.log({
      active: response.data.active,
      status: response.data.status,
      client_id: response.data.client_id,
      auth_type: response.data.auth_type,
      scope: response.data.scope,
      created_at: response.data.created_at,
      authorized_at: response.data.authorized_at,
      expires_at: response.data.expires_at
    });

    return res.status(200).json({
      success: true,
      tokenFingerprint,
      introspection: {
        active: response.data.active,
        status: response.data.status,
        client_id: response.data.client_id,
        auth_type: response.data.auth_type,
        scope: response.data.scope,
        created_at: response.data.created_at,
        authorized_at: response.data.authorized_at,
        expires_at: response.data.expires_at
      }
    });

  } catch (error) {
    console.error("========================================");
    console.error("LINKEDIN TOKEN INTROSPECTION FAILED");
    console.error("========================================");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("LinkedIn response:", error.response.data);

      return res.status(error.response.status).json({
        success: false,
        error: "LinkedIn token introspection failed",
        linkedin: error.response.data
      });
    }

    console.error("Error:", error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


const testLinkedInUserInfo = async (req, res) => {
  console.log("========================================");
  console.log("LINKEDIN USERINFO TEST");
  console.log("========================================");

  try {
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN?.trim();

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        message: "LINKEDIN_ACCESS_TOKEN is not configured"
      });
    }

    console.log("======================================");
    console.log("LINKEDIN USERINFO BROWSER TEST");
    console.log("======================================");

    console.log("Token exists:", !!accessToken);
    console.log("Token length:", accessToken.length);
    console.log(
      "Token preview:",
      `${accessToken.substring(0, 10)}...${accessToken.substring(accessToken.length - 10)}`
    );

    const response = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        validateStatus: () => true
      }
    );

    console.log("LinkedIn status:", response.status);
    console.log("LinkedIn response:", response.data);

    return res.status(response.status).json({
      success: response.status >= 200 && response.status < 300,
      linkedinStatus: response.status,
      data: response.data
    });

  } catch (error) {
    console.error("LinkedIn userinfo error:");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);

      return res.status(error.response.status).json({
        success: false,
        linkedinStatus: error.response.status,
        error: error.response.data
      });
    }

    console.error(error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


const testLinkedInMe = async (req, res) => {
  console.log("========================================");
  console.log("LINKEDIN /v2/me TEST");
  console.log("========================================");

  try {
    const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();

    const fingerprint = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex")
      .substring(0, 16);

    console.log("Token fingerprint:", fingerprint);

    const response = await axios.get(
      "https://api.linkedin.com/v2/me",
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    console.log("LinkedIn /v2/me status:", response.status);
    console.log("LinkedIn /v2/me response:", response.data);

    return res.status(200).json({
      success: true,
      tokenFingerprint: fingerprint,
      linkedinStatus: response.status,
      data: response.data
    });

  } catch (error) {
    console.error("========================================");
    console.error("LINKEDIN /v2/me FAILED");
    console.error("========================================");

    console.error("Status:", error.response?.status);
    console.error("Response:", error.response?.data);

    return res.status(error.response?.status || 500).json({
      success: false,
      tokenFingerprint: process.env.LINKEDIN_ACCESS_TOKEN
        ? crypto
            .createHash("sha256")
            .update(process.env.LINKEDIN_ACCESS_TOKEN.trim())
            .digest("hex")
            .substring(0, 16)
        : null,
      linkedinStatus: error.response?.status,
      linkedinError: error.response?.data || error.message
    });
  }
};


// Getting company posts
/*
const getCompanyPosts = async (req, res) => {
  const accessToken = 'AQX9nMUN9mu0a7o3CWnLJdQ6Jy_1P9vx77t-BZYwDvH5t62Ed4N7Uc_6OCu3NiNxvIIucNRNEXjuZViPPMY_6-JrBYD1FXPEoDdha2ry0BtrlNCwP8IoZUSqYc_YAHiX91qZ5g-Q4HsWfgKPhu6OrPQpky7mgHfd0Nne0mrRyEhPFjuTgV3GA2rPOQIIvRPSQFF57Wpvz-KLkmr5vaDa4AsqNWDegE8ORlP-SGTRkQnh_bdDQE8gVqB_DZXz3ZOF5EpGUUI4dlhFaed9ytUH41xk5Q3cWNAoe7TBAXhXej0cJiKtRRkSa2gIRFwit-w27SX-ZS-32V3pDXsO-wGXlPT7d-jk7g';       // Must contain r_organization_social
  const organizationId = 144819239;     // Your numeric company ID (e.g., 12345678)
  const authorUrn = encodeURIComponent(`urn:li:organization:${organizationId}`);

  console.log("authorUrn: ", authorUrn);
  console.log('Fetching posts for organization URN: ', authorUrn);
  
  const url = `https://api.linkedin.com/rest/posts?author=${authorUrn}&q=author&count=50`;

  try {
    const userResponse = await axios.get(
      "https://api.linkedin.com/v2/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
        }
      }
    );

    console.log("LinkedIn /v2/me status:", userResponse.status);
    console.log("LinkedIn /v2/me response:", userResponse.data);

  } catch (error) {
    console.error('Error fetching user info:', error.response ? error.response.data : error.message);
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken.trim()}`, // .trim() prevents accidental newline characters from copy-pasting
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202603'
      }
    });

    console.log('Company posts retrieved successfully:');
    const posts = response.data.elements || [];
    
    posts.forEach((post, index) => {
      console.log(`\n--- Post [${index + 1}] ---`);
      console.log(`ID: ${post.id}`);
      console.log(`Text/Commentary: ${post.commentary || 'Media only'}`);
      console.log(`Created At: ${post.createdAt}`);
    });

  } catch (error) {
    console.error('Error fetching posts:', error.response ? error.response.data : error.message);
  }
};
*/

const getCompanyPosts_old = async (req, res) => {
  // const accessToken = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  // const accessToken = 'AQX9nMUN9mu0a7o3CWnLJdQ6Jy_1P9vx77t-BZYwDvH5t62Ed4N7Uc_6OCu3NiNxvIIucNRNEXjuZViPPMY_6-JrBYD1FXPEoDdha2ry0BtrlNCwP8IoZUSqYc_YAHiX91qZ5g-Q4HsWfgKPhu6OrPQpky7mgHfd0Nne0mrRyEhPFjuTgV3GA2rPOQIIvRPSQFF57Wpvz-KLkmr5vaDa4AsqNWDegE8ORlP-SGTRkQnh_bdDQE8gVqB_DZXz3ZOF5EpGUUI4dlhFaed9ytUH41xk5Q3cWNAoe7TBAXhXej0cJiKtRRkSa2gIRFwit-w27SX-ZS-32V3pDXsO-wGXlPT7d-jk7g';       // Must contain r_organization_social
  const accessToken = "AQVa4akHX5xyYxO64BSEiZ57dnqfhLkmFVlgfaT7MXqwgYJB3Rnmo9lufFmydUG-BEMlg8qX75v9m_ajE_eo2WALGPfd9fzFs3o42y4cdePfXgdykufuxD-SwFNBGmk8Z3jhdFBB0yPMdmaY1vGy0wJ7MbpiVOREdwMfNKjogJAnYdpjXwEjRZDj0Wrf7y4ZfWaTBX2kwbOvz2T6Znn85HZt4tOIOFlx1PN77BJK_-RAMsLuAXutel72Ef2ZByPevKPrV7E5GQgaydYjkTO5gNyRuWCyVantKRcuXvTopCOfEpkKa7-wxpPWjlQHl4yTuRyF8RisT6T9tEIeFCuLMDDVJ79ZtQ";
  const organizationId = 144819239;
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();

  if (!accessToken) {
    return res.status(500).json({
      success: false,
      error: "LINKEDIN_ACCESS_TOKEN is missing"
    });
  }

  try {

    const params = new URLSearchParams();
    console.log("Introspecting LinkedIn token from getCompanyPosts function ...");
    console.log("params:", params.toString());

    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);
    params.append("token", accessToken);

    console.log("Introspecting LinkedIn token...");
    console.log("params:", params.toString());

    console.log("====================================");
    console.log("LINKEDIN AUTH DEBUG");
    console.log("====================================");

    console.log("Token exists:", true);
    console.log("Token length:", accessToken.length);
    console.log(
      "Token beginning:",
      accessToken.substring(0, 12)
    );
    console.log("Token ending:", accessToken.substring(accessToken.length - 12));

    // -----------------------------------------
    // TEST 1: Introspection
    // -----------------------------------------

    // const params = new URLSearchParams();

    // params.append("client_id", process.env.LINKEDIN_CLIENT_ID?.trim());

    // params.append("client_secret", process.env.LINKEDIN_CLIENT_SECRET?.trim());

    // params.append("token", accessToken);

    const introspectionResponse = await axios.post(
      "https://www.linkedin.com/oauth/v2/introspectToken",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        validateStatus: () => true
      }
    );

    // -----------------------------------------
    // TEST 2: /v2/me
    // -----------------------------------------

    const meResponse = await axios.get(
      "https://api.linkedin.com/v2/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        validateStatus: () => true
      }
    );

    // -----------------------------------------
    // TEST 3: /v2/userinfo
    // -----------------------------------------

    const userInfoResponse = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        validateStatus: () => true
      }
    );

    return res.status(200).json({
      success: true,

      token: {
        exists: true,
        length: accessToken.length,
        beginning: accessToken.substring(0, 12),
        ending: accessToken.substring(accessToken.length - 12)
      },

      introspection: {
        status: introspectionResponse.status,
        data: introspectionResponse.data
      },

      me: {
        status: meResponse.status,
        data: meResponse.data
      },

      userinfo: {
        status: userInfoResponse.status,
        data: userInfoResponse.data
      }
    });

    /*
    // 2. Fetch organization posts 
    const authorUrn = encodeURIComponent(
      `urn:li:organization:${organizationId}`
    );

    const url =
      `https://api.linkedin.com/rest/posts` +
      `?q=author` +
      `&author=${authorUrn}` +
      `&count=50`;

    const postsResponse = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202603"
      },
      validateStatus: () => true
    });

    console.log(
      "LinkedIn posts status:",
      postsResponse.status
    );

    console.log(
      "LinkedIn posts response:",
      postsResponse.data
    );

    return res.status(postsResponse.status).json({
      success: postsResponse.status < 400,
      organizationId,
      organizationUrn: `urn:li:organization:${organizationId}`,
      linkedinStatus: postsResponse.status,
      posts: postsResponse.data
    });
    */

  } catch (error) {
    console.error(
      "LinkedIn API error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
};


const https = require("https");

const testLinkedInUserInfoNative = async (req, res) => {

  try {

    const accessToken =
      process.env.LINKEDIN_ACCESS_TOKEN?.trim();

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        message: "LINKEDIN_ACCESS_TOKEN is missing"
      });
    }

    const options = {
      hostname: "api.linkedin.com",
      path: "/v2/userinfo",
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
      }
    };

    const request = https.request(
      options,
      (response) => {

        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {

          let data;

          try {
            data = JSON.parse(body);
          } catch {
            data = body;
          }

          return res.status(200).json({
            success:
              response.statusCode >= 200 &&
              response.statusCode < 300,

            linkedinStatus: response.statusCode,

            linkedinResponse: data
          });

        });

      }
    );

    request.on("error", (error) => {

      console.error(
        "Native HTTPS LinkedIn error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message
      });

    });

    request.end();

  } catch (error) {

    return res.status(500).json({
      success: false,
      error: error.message
    });

  }
};


const startLinkedInOAuth = (req, res) => {

  const clientId =
    process.env.LINKEDIN_CLIENT_ID?.trim();

  const redirectUri =
    "https://linkedin-webhook-service-1.onrender.com/api/v1/linkedin/oauth/callback";

  const scopes = [
    "openid",
    "profile",
    "email",
    "r_organization_admin",
    "r_organization_social",
    "w_organization_social"
  ].join(" ");

  const authorizationUrl =
    "https://www.linkedin.com/oauth/v2/authorization" +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=browser-test-123` +
    `&scope=${encodeURIComponent(scopes)}`;

  return res.redirect(authorizationUrl);
};


const linkedInOAuthCallback = async (req, res) => {

  try {
    const {
      code,
      state,
      error,
      error_description
    } = req.query;

    if (error) {
      console.error("LinkedIn OAuth error:", error, error_description);
      return res.status(400).json({
        success: false,
        error,
        error_description
      });

    }

    if (!code) {
      console.error("LinkedIn OAuth error: Authorization code was not returned");
      return res.status(400).json({
        success: false,
        message:
          "Authorization code was not returned"
      });

    }

    // -----------------------------
    // Verify state
    // -----------------------------

    // const savedState = req.cookies.linkedin_oauth_state;
    const savedState = "browser-test-123";

    if (!savedState || savedState !== state) {

      console.error("LinkedIn OAuth error: OAuth state mismatch");
      return res.status(400).json({
        success: false,
        message:
          "OAuth state mismatch"
      });

    }

    // -----------------------------
    // Get PKCE verifier
    // -----------------------------

    // const codeVerifier = req.cookies.linkedin_code_verifier;
    // const codeVerifier = req.query.codeVerifier;
    // console.log("PKCE code:", codeVerifier);

    // if (!codeVerifier) {
    //   console.error("LinkedIn OAuth error: PKCE code is missing");
    //   return res.status(400).json({
    //     success: false,
    //     message:
    //       "PKCE code is missing"
    //   });
    // }

    const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();

    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();

    const redirectUri = "https://linkedin-webhook-service-1.onrender.com/api/v1/linkedin/oauth/callback";

    console.log("========== LINKEDIN OAUTH CONFIG ==========");
    console.log("Client ID:", process.env.LINKEDIN_CLIENT_ID?.trim());
    console.log("Client Secret exists:", !!process.env.LINKEDIN_CLIENT_SECRET);
    console.log("Client Secret length:", process.env.LINKEDIN_CLIENT_SECRET?.trim().length);
    console.log("Redirect URI:", process.env.LINKEDIN_REDIRECT_URI?.trim());
    console.log("============================================");

    // -----------------------------
    // Exchange authorization code
    // -----------------------------

    const params = new URLSearchParams();

    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);
    params.append("redirect_uri", redirectUri);
    // params.append("code_verifier", codeVerifier);

    console.log("Exchanging authorization code for access token...");
    console.log("params:", params.toString());

    const response = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        validateStatus: () => true
      }
    );

    console.log("========================================");
    console.log("LinkedIn token response:", response);

    console.log("LinkedIn token response status:", response.status);
    console.log("LinkedIn token response:", response.data);

    if (response.status !== 200) {

      return res.status(response.status).json({
        success: false,
        linkedinStatus: response.status,
        linkedinResponse: response.data
      });

    }

    const newAccessToken = response.data.access_token;

    // -----------------------------
    // Test the NEW token immediately
    // -----------------------------

    const userInfoResponse =
      await axios.get(
        "https://api.linkedin.com/v2/userinfo",
        {
          headers: {
            Authorization:
              `Bearer ${newAccessToken}`
          },
          validateStatus: () => true
        }
      );

    return res.status(200).json({

      success:
        userInfoResponse.status >= 200 &&
        userInfoResponse.status < 300,

      message:
        "LinkedIn OAuth completed",

      token: {
        exists: !!newAccessToken,
        length: newAccessToken?.length
      },

      oauth: {
        status: response.status,
        scope: response.data.scope,
        expires_in: response.data.expires_in
      },

      userinfo: {
        status: userInfoResponse.status,
        data: userInfoResponse.data
      }

    });

  } catch (error) {

    console.error(
      "LinkedIn OAuth callback error:",
      error.response?.data ||
      error.message
    );

    return res.status(500).json({

      success: false,

      error:
        error.response?.data ||
        error.message

    });

  }
};


const getCompanyPosts = async (req, res) => {
  try {
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN?.trim();

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        message: "LINKEDIN_ACCESS_TOKEN is not configured"
      });
    }

    const organizationUrn = "urn:li:organization:144819239";

    const response = await axios.get(
      "https://api.linkedin.com/rest/posts",
      {
        params: {
          q: "author",
          author: organizationUrn,
          count: 10,
          sortBy: "LAST_MODIFIED"
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "Linkedin-Version": "202607"
        },
        validateStatus: () => true
      }
    );

    console.log("LinkedIn Posts status:", response.status);

    console.log("LinkedIn Posts response:", JSON.stringify(response.data, null, 2));

    if (response.status < 200 || response.status >= 300) {
      return res.status(response.status).json({
        success: false,
        linkedinStatus: response.status,
        linkedinResponse: response.data
      });
    }

    return res.status(200).json({
      success: true,
      organization: organizationUrn,
      count: response.data.elements?.length || 0,
      paging: response.data.paging,
      posts: response.data.elements || []
    });

  } catch (error) {
    console.error(
      "LinkedIn company posts error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
};

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {validateWebhook, receiveWebhook, testLinkedInData, testWebhook, testLinkedInToken, introspectLinkedInToken,
  testLinkedInUserInfo, testLinkedInMe, getCompanyPosts, testLinkedInUserInfoNative, startLinkedInOAuth, linkedInOAuthCallback
};
