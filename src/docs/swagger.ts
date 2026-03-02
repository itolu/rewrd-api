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

## Authentication

All API requests require a **Bearer token** (your API key) in the \`Authorization\` header:

\`\`\`
Authorization: Bearer sk_test_your_api_key_here
\`\`\`

API keys are scoped to your merchant account. Use \`sk_test_\` prefixed keys for development and \`sk_live_\` prefixed keys for production.

## Idempotency

Mutation endpoints (\`POST\`) require an \`Idempotency-Key\` header to prevent duplicate operations. The key must be alphanumeric with hyphens or underscores, 1–100 characters:

\`\`\`
Idempotency-Key: credit-cust123-20260225-001
\`\`\`

Replaying a request with the same Idempotency-Key returns the cached response from the original request.

## Rate Limiting

API requests are rate-limited per IP address. If you exceed the limit, you'll receive a \`429 Too Many Requests\` response. Include appropriate retry logic with exponential backoff.

## Error Handling

All errors follow a consistent format:

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

Common error codes include \`validation_error\`, \`unauthorized\`, \`not_found\`, \`insufficient_points\`, and \`internal_error\`.
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
