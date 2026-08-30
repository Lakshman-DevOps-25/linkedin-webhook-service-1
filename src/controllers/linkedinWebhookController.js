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
  return {
    Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
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

const getOrganizationId = async () => {
  console.log("");
  console.log("STEP 1: Getting organization access...");

  const response = await axios.get(
    `${LINKEDIN_API}/organizationAcls`,
    {
      params: {
        q: "roleAssignee",
        role: "ADMINISTRATOR",
        state: "APPROVED"
      },

      headers: getLinkedInHeaders()
    }
  );


  const elements = response.data?.elements || [];


  console.log("Organization ACL count:", elements.length);


  if (!elements.length) {
    throw new Error(
      "No approved organization found for this LinkedIn user"
    );
  }


  /*
   * LinkedIn returns:
   *
   * organization:
   * urn:li:organization:9661
   */

  const organizations = 
      elements.filter(
        item =>
          item.organization
      )
      .map(item => ({

        organizationUrn:
          item.organization,

        organizationId:
          item.organization
            .split(":")
            .pop(),

        role:
          item.role,

        state:
          item.state

      }));


  console.log("Organizations:", organizations);


  /*
   * Remove duplicate organizations.
   */

  const uniqueOrganizations =
    Array.from(
      new Map(
        organizations.map(
          item => [
            item.organizationId,
            item
          ]
        )
      ).values()
    );


  console.log("Unique organizations:", uniqueOrganizations);

  /*
   * For this minimal implementation,
   * process the first approved organization.
   *
   * If your user manages multiple companies,
   * the loop can later be changed to process all.
   */

  const organization = uniqueOrganizations[0];

  if (!organization) {
    throw new Error("Unable to determine organization ID");
  }

  console.log("Organization ID:", organization.organizationId);

  console.log("Organization URN:", organization.organizationUrn);

  return organization;
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

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {validateWebhook, receiveWebhook};