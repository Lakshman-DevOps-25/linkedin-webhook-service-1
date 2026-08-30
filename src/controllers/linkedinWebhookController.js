const crypto = require("crypto");

// ============================================================
// LinkedIn GET Webhook Validation
// ============================================================

const validateWebhook = (req, res) => {
  const requestId = crypto.randomUUID();

  console.log("");
  console.log("========================================");
  console.log("LINKEDIN WEBHOOK VALIDATION");
  console.log("========================================");

  console.log("Request ID:", requestId);
  console.log("Time:", new Date().toISOString());
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Query:", req.query);
  console.log("User-Agent:", req.get("user-agent"));
  console.log("Content-Type:", req.get("content-type"));

  try {
    const clientSecret =
      process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientSecret) {
      console.error(
        "ERROR: LINKEDIN_CLIENT_SECRET is missing"
      );

      return res.status(500).json({
        error: "LinkedIn client secret is not configured"
      });
    }

    // --------------------------------------------------------
    // Read challengeCode
    // --------------------------------------------------------

    const rawChallengeCode =
      req.query.challengeCode;

    console.log(
      "Raw challengeCode:",
      rawChallengeCode
    );

    // Handle both:
    //
    // challengeCode=test123
    //
    // and, defensively:
    //
    // challengeCode[]=test123
    //
    const challengeCode =
      Array.isArray(rawChallengeCode)
        ? rawChallengeCode[0]
        : rawChallengeCode;

    if (
      typeof challengeCode !== "string" ||
      challengeCode.length === 0
    ) {
      console.error(
        "ERROR: Invalid or missing challengeCode"
      );

      return res.status(400).json({
        error: "Missing challengeCode"
      });
    }

    console.log(
      "Normalized challengeCode:",
      challengeCode
    );

    // --------------------------------------------------------
    // Calculate HMAC SHA-256
    // --------------------------------------------------------

    const challengeResponse =
      crypto
        .createHmac(
          "sha256",
          clientSecret
        )
        .update(challengeCode, "utf8")
        .digest("hex");

    console.log(
      "HMAC generated successfully"
    );

    console.log(
      "Challenge length:",
      challengeCode.length
    );

    console.log(
      "Challenge response length:",
      challengeResponse.length
    );

    // --------------------------------------------------------
    // LinkedIn response
    // --------------------------------------------------------

    res.setHeader(
      "Content-Type",
      "application/json"
    );

    const response = {
      challengeCode: challengeCode,
      challengeResponse: challengeResponse
    };

    console.log(
      "Response:",
      response
    );

    console.log(
      "Returning HTTP 200"
    );

    console.log("========================================");

    return res.status(200).json(response);

  } catch (error) {

    console.error("");
    console.error(
      "========================================"
    );
    console.error(
      "LINKEDIN VALIDATION ERROR"
    );
    console.error(
      "========================================"
    );

    console.error(
      "Request ID:",
      requestId
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
      "========================================"
    );

    return res.status(500).json({
      error: "Webhook validation failed"
    });
  }
};


// ============================================================
// LinkedIn POST Webhook
// ============================================================

const receiveWebhook = (req, res) => {

  console.log("");
  console.log("========================================");
  console.log("LINKEDIN WEBHOOK EVENT");
  console.log("========================================");

  console.log(
    "Time:",
    new Date().toISOString()
  );

  console.log(
    "Headers:",
    req.headers
  );

  console.log(
    "Body:",
    req.body
  );

  console.log("========================================");

  // Acknowledge LinkedIn immediately.
  return res.sendStatus(200);
};


module.exports = {
  validateWebhook,
  receiveWebhook
};