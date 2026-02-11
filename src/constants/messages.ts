export const MESSAGES = {
    SUCCESS: {
        CUSTOMER: {
            CREATED: "Customer created successfully",
            UPDATED: "Customer updated successfully",
            RESTRICTED: "Customer restricted successfully",
            UNRESTRICTED: "Customer unrestricted successfully",
            FETCHED: "Customer fetched successfully",
            LISTED: "Customers retrieved successfully",
        }
    },
    MERCHANT: {
        CONFIG_FETCHED: "Merchant configuration retrieved successfully",
        CONFIG_UPDATED: "Merchant configuration updated successfully",
        RULES_FETCHED: "Earning rules retrieved successfully",
        RULE_FETCHED: "Earning rule retrieved successfully",
        RULE_NOT_FOUND: "Earning rule not found",
    },
    ERROR: {
        AUTH: {
            MISSING_API_KEY: "Missing or malformed API key",
            INVALID_API_KEY_FORMAT: "Invalid API key format",
            INVALID_API_KEY: "Invalid API key",
            MERCHANT_INACTIVE: "Merchant account is inactive",
            MERCHANT_RESTRICTED: "Merchant account is restricted",
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
