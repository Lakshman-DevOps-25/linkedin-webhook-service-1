const axios = require("axios");

const LinkedInData = require("../models/LinkedInData");

/**
 * LinkedIn API configuration
 */
const LINKEDIN_VERSION = "202608";
const LINKEDIN_BASE_URL = "https://api.linkedin.com/rest";


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

    console.log("========== NEW LINKEDIN TOKEN ==========");
    console.log("Length:", newAccessToken.length);
    console.log("Beginning:", newAccessToken.substring(0, 12));
    console.log("Ending:", newAccessToken.slice(-12));
    console.log("=========================================");

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


/**
 * Common LinkedIn headers
 */
const getLinkedInHeaders = (accessToken, finder = false) => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": LINKEDIN_VERSION
  };

  if (finder) {
    headers["X-RestLi-Method"] = "FINDER";
  }

  return headers;
};


/**
 * Convert LinkedIn timestamp
 *
 * Example:
 * 1788428087453
 *
 * Result:
 * 03-09-2026 12:24:47
 */
const formatDateTime = (timestamp) => {
  if (!timestamp) {
    return null;
  }

  const date = new Date(Number(timestamp));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const pad = (value) =>
    String(value).padStart(2, "0");

  return (
    `${pad(date.getDate())}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${date.getFullYear()} ` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}:` +
    `${pad(date.getSeconds())}`
  );
};


/**
 * Get detailed post
 */
const getPostDetails = async (
  postUrn,
  accessToken
) => {
  const encodedPostUrn =
    encodeURIComponent(postUrn);

  const url =
    `${LINKEDIN_BASE_URL}/posts/${encodedPostUrn}`;

  console.log("Post details URL:", url);

  return await axios.get(url, {
    headers: getLinkedInHeaders(accessToken),
    validateStatus: () => true
  });
};


/**
 * Get comments for a post
 *
 * LinkedIn:
 * GET /rest/socialActions/{shareUrn}/comments
 */
const getPostComments = async (
  postUrn,
  accessToken
) => {
  const encodedPostUrn =
    encodeURIComponent(postUrn);

  const url =
    `${LINKEDIN_BASE_URL}/socialActions/` +
    `${encodedPostUrn}/comments`;

  console.log("Comments URL:", url);

  return await axios.get(url, {
    headers: getLinkedInHeaders(accessToken),
    validateStatus: () => true
  });
};


/**
 * Get reactions for a post
 *
 * LinkedIn:
 * GET /rest/reactions/(entity:{shareUrn})?q=entity
 */
const getPostReactions = async (
  postUrn,
  accessToken
) => {
  const encodedPostUrn =
    encodeURIComponent(postUrn);

  const url =
    `${LINKEDIN_BASE_URL}/reactions` +
    `(entity:${encodedPostUrn})` +
    `?q=entity`;

  console.log("Reactions URL:", url);

  return await axios.get(url, {
    headers: getLinkedInHeaders(accessToken),
    validateStatus: () => true
  });
};


/**
 * Extract a readable name from LinkedIn profile decoration.
 */
const getProfileName = (profile) => {
  if (!profile) {
    return null;
  }

  /*
   * Possible LinkedIn response formats.
   */

  if (
    profile.firstName &&
    profile.lastName
  ) {
    return `${profile.firstName} ${profile.lastName}`;
  }

  if (
    profile.localizedFirstName &&
    profile.localizedLastName
  ) {
    return (
      `${profile.localizedFirstName} ` +
      `${profile.localizedLastName}`
    );
  }

  if (
    profile.firstName?.localized &&
    profile.lastName?.localized
  ) {
    const first =
      Object.values(profile.firstName.localized)[0];

    const last =
      Object.values(profile.lastName.localized)[0];

    return `${first} ${last}`;
  }

  return null;
};


/**
 * Try to extract member name from an API object.
 *
 * LinkedIn sometimes returns decorated actor~ data.
 */
const getActorName = (item) => {
  if (!item) {
    return null;
  }

  // Direct name
  if (item.name) {
    return item.name;
  }

  // Decorated actor profile
  if (item["actor~"]) {
    const decorated =
      item["actor~"];

    const name =
      getProfileName(decorated);

    if (name) {
      return name;
    }

    if (decorated.vanityName) {
      return decorated.vanityName;
    }
  }

  return null;
};


/**
 * Get member profile.
 *
 * IMPORTANT:
 * This may return 403 depending on the LinkedIn
 * application's available profile permissions.
 */
const getMemberProfile = async (
  personUrn,
  accessToken
) => {
  if (
    !personUrn ||
    !personUrn.startsWith("urn:li:person:")
  ) {
    return null;
  }

  const personId =
    personUrn.replace(
      "urn:li:person:",
      ""
    );

  const url =
    `https://api.linkedin.com/v2/me`;

  /*
   * /v2/me only returns the authenticated member.
   *
   * We therefore DON'T blindly call /v2/me
   * for another person's URN.
   *
   * Return null here when no decorated profile
   * is available from the social-action response.
   */
  return {
    personUrn,
    personId,
    name: null
  };
};


/**
 * Extract media from a LinkedIn post
 */
const extractPostMedia = (post) => {
  const media = [];

  const postMedia =
    post.content?.media;

  if (postMedia) {
    media.push({
      type: "MEDIA",
      id: postMedia.id || null,
      title: postMedia.title || null,
      altText: postMedia.altText || null
    });
  }

  /*
   * Some post types may contain multi-image content.
   */
  if (Array.isArray(post.content?.multiImage?.images)) {
    for (
      const image of
      post.content.multiImage.images
    ) {
      media.push({
        type: "IMAGE",
        id: image.id || null,
        altText: image.altText || null
      });
    }
  }

  return media;
};


/**
 * GET COMPANY POSTS
 */
const getCompanyPosts = async (req, res) => {
  try {
    const accessToken =
      process.env.LINKEDIN_ACCESS_TOKEN?.trim();

    const organizationUrn =
      "urn:li:organization:144819239";

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        message:
          "LINKEDIN_ACCESS_TOKEN is not configured"
      });
    }


    // =====================================================
    // STEP 1: GET ORGANIZATION POSTS
    // =====================================================

    const encodedOrganizationUrn =
      encodeURIComponent(organizationUrn);

    const postsUrl =
      `${LINKEDIN_BASE_URL}/posts` +
      `?author=${encodedOrganizationUrn}` +
      `&q=author` +
      `&count=10` +
      `&sortBy=LAST_MODIFIED`;

    console.log(
      "========== LINKEDIN COMPANY POSTS =========="
    );

    console.log(
      "Organization:",
      organizationUrn
    );

    console.log(
      "Posts URL:",
      postsUrl
    );

    console.log(
      "Token length:",
      accessToken.length
    );

    console.log(
      "============================================"
    );


    const postsResponse =
      await axios.get(
        postsUrl,
        {
          headers:
            getLinkedInHeaders(
              accessToken,
              true
            ),

          validateStatus:
            () => true
        }
      );


    if (
      postsResponse.status < 200 ||
      postsResponse.status >= 300
    ) {
      return res.status(
        postsResponse.status
      ).json({
        success: false,

        linkedinStatus:
          postsResponse.status,

        linkedinResponse:
          postsResponse.data
      });
    }


    const posts =
      postsResponse.data.elements || [];


    // =====================================================
    // STEP 2: PROCESS EVERY POST
    // =====================================================

    const enrichedPosts = [];


    for (const post of posts) {

      console.log(
        "============================================"
      );

      console.log(
        "Processing post:",
        post.id
      );


      // ===================================================
      // STEP 2A: GET FULL POST
      // ===================================================

      const postDetailsResponse =
        await getPostDetails(
          post.id,
          accessToken
        );


      let postDetails = post;


      if (
        postDetailsResponse.status >= 200 &&
        postDetailsResponse.status < 300
      ) {
        postDetails =
          postDetailsResponse.data;
      }


      // ===================================================
      // STEP 2B: GET COMMENTS
      // ===================================================

      const commentsResponse =
        await getPostComments(
          post.id,
          accessToken
        );


      let comments = [];


      if (
        commentsResponse.status >= 200 &&
        commentsResponse.status < 300
      ) {
        comments =
          commentsResponse.data.elements ||
          [];
      } else {
        console.log(
          "Comments API status:",
          commentsResponse.status
        );

        console.log(
          "Comments API response:",
          commentsResponse.data
        );
      }


      // ===================================================
      // STEP 2C: GET REACTIONS
      // ===================================================

      const reactionsResponse =
        await getPostReactions(
          post.id,
          accessToken
        );


      let reactions = [];


      if (
        reactionsResponse.status >= 200 &&
        reactionsResponse.status < 300
      ) {
        reactions =
          reactionsResponse.data.elements ||
          [];
      } else {
        console.log(
          "Reactions API status:",
          reactionsResponse.status
        );

        console.log(
          "Reactions API response:",
          reactionsResponse.data
        );
      }


      // ===================================================
      // STEP 2D: PROCESS COMMENTS
      // ===================================================

      const formattedComments =
        comments.map(comment => {

          const actor =
            comment.actor || null;

          const actorName =
            getActorName(comment);


          return {
            id:
              comment.id || null,

            commentUrn:
              comment.commentUrn || null,

            commenterUrn:
              actor,

            commenterName:
              actorName,

            message:
              comment.message?.text ||
              comment.message ||
              null,

            createdAt:
              formatDateTime(
                comment.created?.time
              ),

            lastModifiedAt:
              formatDateTime(
                comment.lastModified?.time
              ),

            parentComment:
              comment.parentComment ||
              null,

            media:
              comment.content || []
          };
        });


      // ===================================================
      // STEP 2E: PROCESS REACTIONS
      // ===================================================

      const formattedReactions =
        reactions.map(reaction => {

          const actor =
            reaction.created?.actor ||
            reaction.actor ||
            null;

          const actorName =
            getActorName(reaction);


          return {
            id:
              reaction.id || null,

            reactionType:
              reaction.reactionType ||
              null,

            reactorUrn:
              actor,

            reactorName:
              actorName,

            createdAt:
              formatDateTime(
                reaction.created?.time
              ),

            lastModifiedAt:
              formatDateTime(
                reaction.lastModified?.time
              ),

            root:
              reaction.root ||
              null
          };
        });


      // ===================================================
      // STEP 2F: PROCESS MEDIA
      // ===================================================

      const media =
        extractPostMedia(
          postDetails
        );


      // ===================================================
      // STEP 2G: POST AUTHOR
      // ===================================================

      const postAuthorUrn =
        postDetails.author ||
        null;


      /*
       * For an organization post:
       *
       * author =
       * urn:li:organization:144819239
       *
       * Therefore the publisher is the company page.
       *
       * If LinkedIn returns a person URN,
       * the post was authored by that member.
       */

      let postAuthorName = null;

      if (
        postAuthorUrn ===
        organizationUrn
      ) {
        postAuthorName =
          "Organization: " +
          organizationUrn;
      }


      // ===================================================
      // STEP 3: BUILD FINAL POST OBJECT
      // ===================================================

      enrichedPosts.push({

        id:
          postDetails.id || null,

        author:
          postAuthorUrn,

        authorName:
          postAuthorName,

        message:
          postDetails.commentary ||
          null,

        visibility:
          postDetails.visibility ||
          null,

        lifecycleState:
          postDetails.lifecycleState ||
          null,

        createdAt:
          formatDateTime(
            postDetails.createdAt
          ),

        publishedAt:
          formatDateTime(
            postDetails.publishedAt
          ),

        lastModifiedAt:
          formatDateTime(
            postDetails.lastModifiedAt
          ),

        media,

        reactions:
          formattedReactions,

        reactionCount:
          formattedReactions.length,

        comments:
          formattedComments,

        commentCount:
          formattedComments.length
      });
    }


    // =====================================================
    // STEP 4: RETURN RESPONSE
    // =====================================================

    return res.status(200).json({

      success: true,

      organization:
        organizationUrn,

      count:
        enrichedPosts.length,

      posts:
        enrichedPosts
    });


  } catch (error) {

    console.error(
      "LinkedIn Company Posts error:",
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


module.exports = {
  startLinkedInOAuth, linkedInOAuthCallback, getCompanyPosts
};