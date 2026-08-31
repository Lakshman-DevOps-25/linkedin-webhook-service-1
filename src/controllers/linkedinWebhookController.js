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

    const rawChallengeCode = req.query.challengeCode;
    const challengeCode = Array.isArray(rawChallengeCode) ? rawChallengeCode[0] : rawChallengeCode;

    if (!challengeCode) {
      console.error("challengeCode is missing");
      return res.status(400).json({
        success: false,
        error: "Missing challengeCode"
      });
    }
    console.log("challengeCode:", challengeCode);

    /*
     * Generate HMAC SHA256.
     */
    const challengeResponse = crypto.createHmac("sha256",clientSecret).update(String(challengeCode),"utf8").digest("hex");

    console.log("challengeResponse:",challengeResponse);
    console.log("Returning HTTP 200");
    console.log("========================================");

    /*
     * IMPORTANT:
     *
     * Do NOT call LinkedIn organization/posts/comments
     * APIs here.
     *
     * This request must finish quickly.
     */
    return res.status(200).json({
      challengeCode,
      challengeResponse
    });
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
const receiveWebhook = async (req, res) => {
  try {
    console.log("");
    console.log("========================================");
    console.log("LINKEDIN WEBHOOK EVENT RECEIVED");
    console.log("========================================");

    console.log(JSON.stringify(req.body, null,2));

    /*
     * IMPORTANT:
     *
     * Acknowledge LinkedIn immediately.
     *
     * Do not make LinkedIn wait for:
     *
     * organizationAcls
     * posts
     * comments
     * MongoDB
     */
    res.sendStatus(200);

    /*
     * Start processing after response.
     */

    processLinkedInData().catch((error) => {
        console.error("LinkedIn background processing failed:");
        console.error(error.response?.data || error.message);
      });
  } catch (error) {
    console.error("Webhook receive error:",
      error.message
    );

    /*
     * Always acknowledge webhook.
     */

    if (!res.headersSent) {
      res.sendStatus(200);
    }
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

  console.log("STEP 1: Getting organization access...");

  try {

    const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();

    console.log("LinkedIn token exists:", !!token);

    console.log("LinkedIn token length:", token?.length);

    console.log("LinkedIn token prefix:", token ? token.substring(0, 8) + "..." : "MISSING");

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
     */
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
      `${LINKEDIN_API}/rest/posts`,
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
  async () => {
    console.log("");
    console.log("========================================");
    console.log("STARTING LINKEDIN DATA PROCESSING");
    console.log("========================================");

    /*
     * Check access token.
     */

    if (!process.env.LINKEDIN_ACCESS_TOKEN) {
      throw new Error("LINKEDIN_ACCESS_TOKEN is missing");
    }

    /*
     * STEP 1
     *
     * Get organization ID automatically.
     */

    const {organizationId, organizationUrn} = await getOrganizationId();

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


  const testLinkedInData = async (req, res) => {

  console.log("");
  console.log("========================================");
  console.log("MANUAL LINKEDIN DATA TEST");
  console.log("========================================");

  try {

    /*
     * IMPORTANT:
     * Do not wait for the whole operation.
     */

    res.status(202).json({
      success: true,
      message:
        "LinkedIn data processing started"
    });


    console.log(
      "Calling processLinkedInData()..."
    );


    await processLinkedInData();


    console.log(
      "processLinkedInData() completed"
    );


  } catch (error) {

    console.error(
      "processLinkedInData() failed:"
    );

    console.error(
      error.response?.data ||
      error.message
    );

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

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {validateWebhook, receiveWebhook, testLinkedInData, testWebhook};
