const axios = require("axios");
const fs = require("fs");
const path = require("path");

const LINKEDIN_BASE_URL = "https://api.linkedin.com/rest";

const ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_VERSION = "202608";

const ORGANIZATION_ID = process.env.LINKEDIN_ORGANIZATION_ID || "144819239";
const ORGANIZATION_URN = `urn:li:organization:${ORGANIZATION_ID}`;

// ============================================================
// DIRECTORIES
// ============================================================

const MEDIA_ROOT = path.join(__dirname, "../../downloads/linkedin-media");

if (!fs.existsSync(MEDIA_ROOT)) {
    fs.mkdirSync(MEDIA_ROOT, {
        recursive: true
    });
}


// ============================================================
// COMMON HEADERS
// ============================================================

function getLinkedInHeaders(extraHeaders = {}) {
    return {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "LinkedIn-Version": LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
        ...extraHeaders
    };
}


// ============================================================
// DATE FORMAT
// dd-mm-yyyy H:m:s
// ============================================================

function formatDateTime(timestamp) {

    if (!timestamp) {
        return null;
    }

    const date = new Date(Number(timestamp));

    if (isNaN(date.getTime())) {
        return null;
    }

    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();

    const H = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();

    return `${dd}-${mm}-${yyyy} ${H}:${m}:${s}`;
}


// ============================================================
// DOWNLOAD DIRECTORY FOR EACH POST
// ============================================================

function getPostMediaDirectory(postUrn) {

    const safePostId = postUrn
        .replace(/[^a-zA-Z0-9_-]/g, "_");

    const directory = path.join(
        MEDIA_ROOT,
        safePostId
    );

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, {
            recursive: true
        });
    }

    return directory;
}


// ============================================================
// DOWNLOAD FILE
// ============================================================

async function downloadFile(fileUrl, destinationPath) {

    try {

        console.log("----------------------------------------");
        console.log("Downloading media");
        console.log("URL:", fileUrl);
        console.log("Destination:", destinationPath);

        const response = await axios.get(fileUrl, {
            responseType: "stream",
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 120000
        });

        await new Promise((resolve, reject) => {

            const writer = fs.createWriteStream(destinationPath);

            response.data.pipe(writer);

            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        console.log("MEDIA DOWNLOAD SUCCESS");
        console.log(destinationPath);

        return {
            success: true,
            localPath: destinationPath
        };

    } catch (error) {

        console.error(
            "MEDIA DOWNLOAD FAILED:",
            error.response?.data || error.message
        );

        return {
            success: false,
            localPath: null,
            error: error.response?.data || error.message
        };
    }
}


// ============================================================
// GET COMPANY POSTS
// ============================================================

async function fetchCompanyPosts() {

    try {

        console.log("========================================");
        console.log("GET COMPANY POSTS");
        console.log("Organization:", ORGANIZATION_URN);
        console.log("========================================");

        if (!ACCESS_TOKEN) {
            throw new Error(
                "LINKEDIN_ACCESS_TOKEN environment variable is missing"
            );
        }

        /*
         * IMPORTANT:
         *
         * Encode the Organization URN exactly once.
         */

        const encodedOrganizationUrn =
            encodeURIComponent(ORGANIZATION_URN);

        const postsUrl =
            `${LINKEDIN_BASE_URL}/posts` +
            `?author=${encodedOrganizationUrn}` +
            `&q=author` +
            `&count=100` +
            `&sortBy=LAST_MODIFIED`;

        console.log("Posts URL:", postsUrl);

        const response = await axios.get(postsUrl, {

            headers: getLinkedInHeaders({
                "X-RestLi-Method": "FINDER"
            }),

            validateStatus: () => true
        });

        console.log("Posts API status:", response.status);

        if (response.status !== 200) {

            console.error(
                "Posts API error:",
                response.data
            );

            return {
                success: false,
                status: response.status,
                error: response.data
            };
        }

        const elements = response.data.elements || [];

        console.log(
            `Found ${elements.length} organization posts`
        );

        const posts = [];

        for (const post of elements) {

            console.log("\n========================================");
            console.log("PROCESSING POST:", post.id);
            console.log("========================================");

            const postData = await processPost(post);

            posts.push(postData);
        }

        return {
            success: true,
            organization: ORGANIZATION_URN,
            count: posts.length,
            paging: response.data.paging || {},
            posts
        };

    } catch (error) {

        console.error(
            "getCompanyPosts ERROR:",
            error.response?.data || error.message
        );

        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
}


// ============================================================
// PROCESS INDIVIDUAL POST
// ============================================================

async function processPost(post) {

    const postUrn = post.id;

    /*
     * --------------------------------------------------------
     * POST INFORMATION
     * --------------------------------------------------------
     */

    const postData = {

        id: postUrn,

        author: post.author,

        /*
         * For an organization post, LinkedIn returns the
         * organization as author.
         *
         * The human admin who clicked "Post" is not normally
         * included in the Posts API response.
         */

        authorName:
            post.author === ORGANIZATION_URN
                ? `Organization ${ORGANIZATION_ID}`
                : post.author,

        message: post.commentary || "",

        visibility: post.visibility,

        lifecycleState: post.lifecycleState,

        createdAt: formatDateTime(post.createdAt),

        publishedAt: formatDateTime(post.publishedAt),

        lastModifiedAt:
            formatDateTime(post.lastModifiedAt),

        reactions: {
            available: false,
            count: 0,
            items: []
        },

        comments: {
            available: false,
            count: 0,
            items: []
        },

        media: []
    };


    // ========================================================
    // REACTIONS
    // ========================================================

    try {

        /*
         * KEEP YOUR PREVIOUS WORKING REACTION FUNCTION HERE.
         *
         * Do NOT use the newer:
         *
         * /reactions(entity:...)
         *
         * implementation that returned 404 in your environment.
         */

        const reactionsResult =
            await getPostReactions(postUrn);

        if (reactionsResult) {

            postData.reactions = reactionsResult;
        }

    } catch (error) {

        console.error(
            "Reaction processing failed:",
            error.response?.data || error.message
        );

        postData.reactions = {
            available: false,
            count: 0,
            items: [],
            reason:
                "Unable to retrieve reactions"
        };
    }


    // ========================================================
    // COMMENTS
    // ========================================================

    try {

        const commentsResult =
            await getPostComments(postUrn);

        if (commentsResult) {

            postData.comments = commentsResult;
        }

    } catch (error) {

        console.error(
            "Comment processing failed:",
            error.response?.data || error.message
        );

        postData.comments = {
            available: false,
            count: 0,
            items: [],
            reason:
                "Community Management API is not enabled"
        };
    }


    // ========================================================
    // MEDIA
    // ========================================================

    try {

        const mediaResult =
            await extractAndDownloadPostMedia(
                post,
                postUrn
            );

        postData.media = mediaResult;

    } catch (error) {

        console.error(
            "Media processing failed:",
            error.response?.data || error.message
        );

        postData.media = [];
    }


    return postData;
}


// ============================================================
// COMMENTS
// ============================================================

async function getPostComments(postUrn) {

    const encodedPostUrn =
        encodeURIComponent(postUrn);

    const commentsUrl =
        `${LINKEDIN_BASE_URL}/socialActions/` +
        `${encodedPostUrn}/comments`;

    console.log("Comments URL:", commentsUrl);

    const response = await axios.get(
        commentsUrl,
        {
            headers: getLinkedInHeaders(),
            validateStatus: () => true
        }
    );

    console.log(
        "Comments API status:",
        response.status
    );

    if (response.status === 403) {

        console.log(
            "Comments unavailable - Community Management API permission"
        );

        return {
            available: false,
            count: 0,
            items: [],
            reason:
                "Community Management API is not enabled"
        };
    }

    if (response.status !== 200) {

        console.error(
            "Comments API response:",
            response.data
        );

        return {
            available: false,
            count: 0,
            items: [],
            reason: response.data?.message ||
                "Comments API failed"
        };
    }

    const elements =
        response.data.elements || [];

    const comments = elements.map(comment => {

        return {

            id: comment.$URN ||
                comment.id ||
                null,

            actor:
                comment.actor || null,

            actorName:
                comment.actor || null,

            message:
                comment.message?.text ||
                comment.commentary ||
                "",

            createdAt:
                formatDateTime(
                    comment.created?.time
                ),

            lastModifiedAt:
                formatDateTime(
                    comment.lastModified?.time
                )
        };
    });

    return {

        available: true,

        count: comments.length,

        items: comments
    };
}


// ============================================================
// REACTIONS
// ============================================================

// async function getPostReactions(postUrn) {

//     /*
//      * IMPORTANT:
//      *
//      * Put the exact reaction implementation that was working
//      * in your previous generated code here.
//      *
//      * The current code intentionally does not use:
//      *
//      * /reactions(entity:urn...)
//      *
//      * because your latest test returned:
//      *
//      * 404 RESOURCE_NOT_FOUND
//      */

//     try {

//         /*
//          * Example:
//          *
//          * If your previous implementation already has a working
//          * LinkedIn reactions request, keep that request here.
//          */

//         const encodedPostUrn =
//             encodeURIComponent(postUrn);

//         /*
//          * If your earlier working implementation used another
//          * endpoint, replace ONLY the URL below with that exact
//          * endpoint.
//          */

//         const reactionsUrl =
//             `${LINKEDIN_BASE_URL}/socialMetadata/` +
//             `${encodedPostUrn}`;

//         console.log(
//             "Reactions/Social Metadata URL:",
//             reactionsUrl
//         );

//         const response = await axios.get(
//             reactionsUrl,
//             {
//                 headers: getLinkedInHeaders(),
//                 validateStatus: () => true
//             }
//         );

//         console.log(
//             "Reactions API status:",
//             response.status
//         );

//         if (
//             response.status !== 200 &&
//             response.status !== 207
//         ) {

//             console.error(
//                 "Reactions API response:",
//                 response.data
//             );

//             return {
//                 available: false,
//                 count: 0,
//                 items: [],
//                 reason:
//                     response.data?.message ||
//                     "Unable to retrieve reactions"
//             };
//         }

//         const elements =
//             response.data?.elements || [];

//         const reactions =
//             elements.map(reaction => {

//                 return {

//                     id:
//                         reaction.id ||
//                         reaction.$URN ||
//                         null,

//                     actor:
//                         reaction.actor ||
//                         reaction.reactor ||
//                         null,

//                     actorName:
//                         reaction.actor ||
//                         reaction.reactor ||
//                         null,

//                     reactionType:
//                         reaction.reactionType ||
//                         reaction.type ||
//                         null,

//                     createdAt:
//                         formatDateTime(
//                             reaction.created?.time ||
//                             reaction.createdAt
//                         )
//                 };
//             });

//         return {

//             available: true,

//             count: reactions.length,

//             items: reactions
//         };

//     } catch (error) {

//         console.error(
//             "getPostReactions ERROR:",
//             error.response?.data ||
//             error.message
//         );

//         return {

//             available: false,

//             count: 0,

//             items: [],

//             reason:
//                 error.response?.data?.message ||
//                 error.message
//         };
//     }
// }

async function getPostReactions(postUrn) {

    const encodedPostUrn =
        encodeURIComponent(postUrn);

    const reactionsUrl =
        `${LINKEDIN_BASE_URL}/reactions` +
        `(entity:${encodedPostUrn})` +
        `?q=entity`;

    const response = await axios.get(
        reactionsUrl,
        {
            headers: getLinkedInHeaders(),
            validateStatus: () => true
        }
    );

    if (response.status !== 200) {
        console.error(
            "Reactions API response:",
            response.data
        );

        return [];
    }

    return response.data.elements || [];
}


// ============================================================
// EXTRACT MEDIA + DOWNLOAD
// ============================================================

async function extractAndDownloadPostMedia(
    post,
    postUrn
) {

    const media = [];

    /*
     * --------------------------------------------------------
     * 1. Extract media URNs from Posts API response
     * --------------------------------------------------------
     */

    const mediaContent =
        post.content?.media;

    if (!mediaContent) {

        console.log(
            "No media found in post:",
            postUrn
        );

        return media;
    }


    /*
     * LinkedIn can return media IDs such as:
     *
     * urn:li:image:...
     * urn:li:video:...
     * urn:li:document:...
     */

    const mediaUrn =
        mediaContent.id ||
        mediaContent.originalUrl ||
        null;

    if (!mediaUrn) {

        console.log(
            "Media object found but no media ID:",
            mediaContent
        );

        return media;
    }


    console.log(
        "Media URN:",
        mediaUrn
    );


    // ========================================================
    // 2. GET MEDIA DETAILS
    // ========================================================

    let mediaDetails = null;

    try {

        mediaDetails =
            await getMediaDetails(mediaUrn);

    } catch (error) {

        console.error(
            "Media metadata failed:",
            error.response?.data ||
            error.message
        );
    }


    /*
     * --------------------------------------------------------
     * 3. Determine download URL
     * --------------------------------------------------------
     */

    const downloadUrl =
        mediaDetails?.downloadUrl ||
        mediaDetails?.downloadUrlExpiresAt
            ? mediaDetails.downloadUrl
            : mediaDetails?.url ||
              mediaContent?.originalUrl ||
              null;


    /*
     * If the previous implementation already returned a
     * working download URL, this code will use it.
     */

    if (!downloadUrl) {

        console.log(
            "No downloadable URL available for:",
            mediaUrn
        );

        media.push({

            id: mediaUrn,

            type: getMediaType(mediaUrn),

            downloaded: false,

            localPath: null,

            reason:
                "LinkedIn did not provide a downloadable media URL"
        });

        return media;
    }


    // ========================================================
    // 4. DOWNLOAD TO LOCAL SYSTEM
    // ========================================================

    const mediaType =
        getMediaType(mediaUrn);

    const extension =
        getFileExtension(
            mediaType,
            mediaDetails
        );

    const safeMediaId =
        mediaUrn
            .replace(/[^a-zA-Z0-9_-]/g, "_");

    const fileName =
        `${safeMediaId}${extension}`;

    const postDirectory =
        getPostMediaDirectory(postUrn);

    const localPath =
        path.join(
            postDirectory,
            fileName
        );


    const downloadResult =
        await downloadFile(
            downloadUrl,
            localPath
        );


    media.push({

        id: mediaUrn,

        type: mediaType,

        downloadUrl,

        downloaded:
            downloadResult.success,

        localPath:
            downloadResult.localPath,

        fileName,

        error:
            downloadResult.error || null
    });


    return media;
}


// ============================================================
// MEDIA DETAILS
// ============================================================

async function getMediaDetails(mediaUrn) {

    const encodedMediaUrn =
        encodeURIComponent(mediaUrn);

    /*
     * Keep this compatible with the media endpoint that was
     * already working in your previous implementation.
     */

    let endpoint;

    if (mediaUrn.startsWith("urn:li:image:")) {

        endpoint =
            `${LINKEDIN_BASE_URL}/images/` +
            `${encodedMediaUrn}`;

    } else if (
        mediaUrn.startsWith("urn:li:video:")
    ) {

        endpoint =
            `${LINKEDIN_BASE_URL}/videos/` +
            `${encodedMediaUrn}`;

    } else if (
        mediaUrn.startsWith("urn:li:document:")
    ) {

        endpoint =
            `${LINKEDIN_BASE_URL}/documents/` +
            `${encodedMediaUrn}`;

    } else {

        throw new Error(
            `Unsupported LinkedIn media URN: ${mediaUrn}`
        );
    }


    console.log(
        "Media details URL:",
        endpoint
    );

    const response = await axios.get(
        endpoint,
        {
            headers: getLinkedInHeaders(),
            validateStatus: () => true
        }
    );


    if (response.status !== 200) {

        console.error(
            "Media details response:",
            response.data
        );

        throw new Error(
            response.data?.message ||
            `Media API returned ${response.status}`
        );
    }


    /*
     * Normalize the response so the download function doesn't
     * need to know which media API returned it.
     */

    return {

        id: mediaUrn,

        downloadUrl:
            response.data?.downloadUrl ||
            response.data?.downloadUrlExpiresAt ||
            response.data?.url ||
            response.data?.downloadUrl,

        raw:
            response.data
    };
}


// ============================================================
// MEDIA TYPE
// ============================================================

function getMediaType(mediaUrn) {

    if (!mediaUrn) {
        return "unknown";
    }

    if (mediaUrn.includes(":image:")) {
        return "image";
    }

    if (mediaUrn.includes(":video:")) {
        return "video";
    }

    if (mediaUrn.includes(":document:")) {
        return "document";
    }

    return "unknown";
}


// ============================================================
// FILE EXTENSION
// ============================================================

function getFileExtension(
    mediaType,
    mediaDetails
) {

    const url =
        mediaDetails?.downloadUrl ||
        mediaDetails?.url ||
        "";

    const cleanUrl =
        url.split("?")[0];

    const ext =
        path.extname(cleanUrl);

    if (ext && ext.length <= 6) {
        return ext;
    }


    switch (mediaType) {

        case "image":
            return ".jpg";

        case "video":
            return ".mp4";

        case "document":
            return ".pdf";

        default:
            return ".bin";
    }
}


// ============================================================
// EXPRESS CONTROLLER
// ============================================================

const getCompanyPosts = async (req, res) => {

    try {

        const result = await fetchCompanyPosts();

        return res.status(result.success ? 200 : 500).json(result);

    } catch (error) {

        console.error(
            "Company posts controller error:",
            error
        );

        return res.status(500).json({

            success: false,

            error:
                error.response?.data ||
                error.message
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

module.exports = {getCompanyPosts, startLinkedInOAuth, linkedInOAuthCallback};