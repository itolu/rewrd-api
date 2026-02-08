export const MESSAGES = {
    SUCCESS: {
        CUSTOMER: {
            CREATED: "Customer created successfully",
            UPDATED: "Customer updated successfully",
            RESTRICTED: "Customer restricted successfully",
            FETCHED: "Customer fetched successfully",
            LISTED: "Customers retrieved successfully",
        }
    },
    ERROR: {
        AUTH: {
            MISSING_API_KEY: "Missing or malformed API key",
            INVALID_API_KEY_FORMAT: "Invalid API key format",
            INVALID_API_KEY: "Invalid API key",
            MERCHANT_INACTIVE: "Merchant account is inactive",
            MERCHANT_SUSPENDED: "Merchant account is suspended",
            MERCHANT_PAYMENT_REQUIRED: "Payment required to continue using the API",
        },
        CUSTOMER: {
            NOT_FOUND: "Customer not found",
            ID_REQUIRED: "Customer ID is required",
            NOT_ACTIVE: "Customer is not active",
        },
        COMMON: {
            VALIDATION_ERROR: "Validation Error",
            INTERNAL_SERVER_ERROR: "Internal Server Error",
            ROUTE_NOT_FOUND: "Endpoint not found",
            IDEMPOTENCY_KEY_REQUIRED: "Idempotency-Key header is required for POST requests",
            INVALID_IDEMPOTENCY_KEY: "Idempotency-Key must be alphanumeric with hyphens or underscores (1-100 characters)",
        }
    }
};
