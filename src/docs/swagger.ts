import swaggerJsdoc from "swagger-jsdoc";
import { env } from "../config/env";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Rewrd API",
            version: "1.0.0",
            description: `
## Introduction

The Rewrd API is a RESTful API that powers the **Rewrd Loyalty Platform**. It provides programmatic access to manage customers, loyalty points, earning rules, and merchant configurations.

Use the Rewrd API to:
- **Enroll customers** into your loyalty program
- **Credit points** when customers make purchases or complete actions
- **Redeem points** when customers want to use their earned rewards
- **View analytics** on your loyalty program's performance

---

## Authentication

All API requests must include your **API key** in the \`Authorization\` header using the **Bearer** scheme. You can find your API key in the [Rewrd Dashboard](https://getrewrd.com) under **Settings → API Keys**.

\`\`\`
Authorization: Bearer sk_test_your_api_key_here
\`\`\`

**Test vs. Live Keys:**

| Key Prefix | Environment | Purpose |
|---|---|---|
| \`sk_test_\` | Sandbox | Use during development. No real points are affected. |
| \`sk_live_\` | Production | Use in your live application. Real points are credited/debited. |

> ⚠️ **Keep your API keys secret.** Do not expose them in client-side code (e.g. browser JavaScript, mobile apps). Always call the Rewrd API from your backend server.

**Example request using curl:**

\`\`\`bash
curl https://api.getrewrd.com/v1/customers \\
  -H "Authorization: Bearer sk_test_abc123..."
\`\`\`

If your API key is missing or invalid, you will receive a \`401 Unauthorized\` error.

---

## Idempotency

**What is idempotency?** Idempotency ensures that if you accidentally send the same request twice (e.g. due to a network timeout or retry), the operation is only performed **once**. This prevents issues like crediting points to a customer twice for the same purchase.

All mutation endpoints (\`POST\`) require an \`Idempotency-Key\` header. The key must be alphanumeric with hyphens or underscores, between 1 and 100 characters:

\`\`\`
Idempotency-Key: credit-cust123-20260225-001
\`\`\`

**How to generate good idempotency keys:**
- Combine the action, customer identifier, and a unique reference (like an order ID or timestamp)
- Examples: \`credit-cust_abc123-ORD001\`, \`redeem-cust_xyz-20260309-tx1\`
- Each unique operation should have a unique key

**What happens when you replay a key?**
- **Same key + same request body** → Returns the cached response from the original request (no duplicate operation)
- **Same key + different request body** → Returns a \`409 Conflict\` error to alert you that the key was already used with different parameters

---

## Rate Limiting

API requests are rate-limited per IP address to protect the platform from abuse. If you exceed the limit, you'll receive a \`429 Too Many Requests\` response.

**How to handle rate limits:** Implement **exponential backoff** — wait progressively longer between retries:

\`\`\`javascript
async function callWithRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries - 1) {
        // Wait 1s, then 2s, then 4s...
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
\`\`\`

---

## Error Handling

All errors follow a consistent JSON format, making it easy to handle them programmatically:

\`\`\`json
{
  "status": false,
  "message": "Human-readable error message",
  "error": {
    "code": "machine_readable_error_code",
    "request_id": "unique-request-id",
    "description": "Detailed error description"
  }
}
\`\`\`

**Error Code Reference:**

| Error Code | HTTP Status | Meaning |
|---|---|---|
| \`validation_error\` | 400 | Your request body is missing required fields or has invalid values. Check the \`description\` field for details. |
| \`unauthorized\` | 401 | Your API key is missing, invalid, or has been revoked. |
| \`forbidden\` | 403 | Your API key is valid but you don't have permission for this action (e.g. customer is restricted). |
| \`not_found\` | 404 | The requested resource (customer, earning rule, etc.) does not exist. |
| \`conflict\` | 409 | An idempotency key was reused with different request parameters. |
| \`insufficient_points\` | 400 | The customer does not have enough points for the requested redemption. |
| \`internal_error\` | 500 | Something went wrong on our end. Retry the request or contact support if it persists. |

**Tip:** Always check \`error.code\` in your code (not the \`message\`) for programmatic error handling, since messages may change over time.

---

## Webhooks

Webhooks allow Rewrd to **push real-time notifications** to your server when events occur — for example, when a customer earns or redeems points. Instead of polling the API, you receive an HTTP POST request to your configured URL with the event data.

**Supported events:**

| Event | Description |
|---|---|
| \`customer.created\` | A new customer was enrolled in your loyalty program. |
| \`points.earned\` | Points were credited to a customer's account. |
| \`points.redeemed\` | Points were deducted from a customer's account. |

### Setting Up Webhooks

1. Go to the **Rewrd Dashboard** → **Settings** → **Webhooks**
2. Enter your **Webhook URL** (the endpoint on your server that will receive events)
3. Copy your **Webhook Secret** (starts with \`whsec_\`) — you'll need this to verify signatures

### Webhook Payload

Every webhook sends a JSON payload with the following structure:

\`\`\`json
{
  "id": "evt_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "event": "points.earned",
  "created_at": "2026-03-09T14:30:00.000Z",
  "data": {
    "customer_uid": "cust_abc123",
    "points": 50,
    "balance_after": 1550
  }
}
\`\`\`

### Verifying Webhook Signatures

> 🔒 **Important:** Always verify webhook signatures before processing the payload. This ensures the request actually came from Rewrd and hasn't been tampered with.

Every webhook request includes an \`X-Rewrd-Signature\` header with the following format:

\`\`\`
X-Rewrd-Signature: t=1672531200,v1=a1b2c3d4e5f6...
\`\`\`

The header contains two parts:
- **\`t\`** — A Unix timestamp (seconds) of when the webhook was sent
- **\`v1\`** — An HMAC-SHA256 signature of the payload

**Step-by-step verification:**

**Step 1: Extract the timestamp and signature**
Parse the \`X-Rewrd-Signature\` header by splitting on \`,\`, then extract the values after \`t=\` and \`v1=\`.

**Step 2: Prepare the signed payload string**
Concatenate the timestamp, a literal dot character (\`.\`), and the raw JSON request body:
\`\`\`
{timestamp}.{raw_json_body}
\`\`\`

**Step 3: Compute the expected signature**
Generate an HMAC using SHA-256, with your **webhook secret** as the key and the signed payload string (from Step 2) as the message.

**Step 4: Compare the signatures**
Compare your computed signature with the \`v1\` value from the header. If they match, the webhook is authentic.

**Step 5: (Recommended) Prevent replay attacks**
Check that the \`t\` timestamp is within an acceptable window (e.g. 5 minutes). Reject the webhook if the timestamp is too old — this prevents attackers from replaying old webhook payloads.

### Node.js Verification Example

\`\`\`javascript
const crypto = require('crypto');

function verifyWebhookSignature(rawBody, signatureHeader, webhookSecret) {
  // Step 1: Extract timestamp and signature
  const parts = signatureHeader.split(',');
  let timestamp, signature;

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signature = value;
  }

  if (!timestamp || !signature) {
    throw new Error('Invalid signature header format');
  }

  // Step 2: Prepare the signed payload
  const signedPayload = timestamp + '.' + rawBody;

  // Step 3: Compute the expected signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');

  // Step 4: Compare signatures
  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );

  if (!isValid) {
    throw new Error('Webhook signature verification failed');
  }

  // Step 5: Check timestamp tolerance (5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - parseInt(timestamp, 10) > 300) {
    throw new Error('Webhook timestamp is too old — possible replay attack');
  }

  return JSON.parse(rawBody);
}

// Usage in an Express route:
app.post('/webhooks/rewrd', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = verifyWebhookSignature(
      req.body.toString(),
      req.headers['x-rewrd-signature'],
      'whsec_your_webhook_secret'
    );
    // Process the verified event
    console.log('Received event:', event.event);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    res.status(400).send('Invalid signature');
  }
});
\`\`\`

> 💡 **Tip:** Make sure to use the **raw request body** (not a parsed JSON object) for signature verification. If your framework parses the body automatically, the re-serialized JSON may differ from the original, causing signature mismatches.

### Retry Behavior

If your endpoint does not return a \`2xx\` status code, Rewrd will retry the webhook up to **3 times** with exponential backoff (1s, 2s, 4s delays). After 3 failed attempts, the webhook is dropped. Ensure your endpoint responds quickly (within 5 seconds) to avoid timeouts.
            `.trim(),
            contact: {
                name: "Rewrd Engineering",
                url: "https://getrewrd.com",
            },
        },
        servers: [
            ...(env.PUBLIC_URL
                ? [
                    {
                        url: `${env.PUBLIC_URL}/v1`,
                        description: "Development Server",
                    },
                ]
                : []),
            {
                url: `http://localhost:${env.PORT}/v1`,
                description: "Local Server",
            },
        ],
        tags: [
            {
                name: "Customers",
                description: "Manage your loyalty program customers. Create, update, list, and control the status of customers enrolled in your points program.",
            },
            {
                name: "Points",
                description: "Credit and redeem loyalty points for customers. View transaction history and manage the points lifecycle.",
            },
            {
                name: "Merchant",
                description: "View and update your merchant configuration, earning rules, IP security settings, and analytics dashboard.",
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Enter your API Key (e.g. sk_test_...)",
                },
            },
            schemas: {
                ErrorResponse: {
                    type: "object",
                    description: "Standard error response returned by all endpoints on failure.",
                    properties: {
                        status: {
                            type: "boolean",
                            example: false,
                            description: "Always `false` for error responses.",
                        },
                        message: {
                            type: "string",
                            example: "Customer not found",
                            description: "Human-readable error message.",
                        },
                        error: {
                            type: "object",
                            properties: {
                                code: {
                                    type: "string",
                                    example: "not_found",
                                    description: "Machine-readable error code for programmatic handling.",
                                },
                                request_id: {
                                    type: "string",
                                    example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                                    description: "Unique identifier for this request, useful for support inquiries.",
                                },
                                description: {
                                    type: "string",
                                    example: "Customer not found",
                                    description: "Detailed description of the error.",
                                },
                            },
                        },
                    },
                },
                Pagination: {
                    type: "object",
                    description: "Pagination metadata included in list responses.",
                    properties: {
                        page: {
                            type: "integer",
                            example: 1,
                            description: "Current page number.",
                        },
                        limit: {
                            type: "integer",
                            example: 50,
                            description: "Number of items per page.",
                        },
                        total: {
                            type: "integer",
                            example: 150,
                            description: "Total number of items across all pages.",
                        },
                        total_pages: {
                            type: "integer",
                            example: 3,
                            description: "Total number of pages.",
                        },
                    },
                },
            },
        },
        security: [
            {
                BearerAuth: [],
            },
        ],
    },
    apis: ["./src/routes/*.ts"], // Path to the API docs
};

export const specs = swaggerJsdoc(options);
