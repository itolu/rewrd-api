export const MESSAGES = {
    SUCCESS: {
        CUSTOMER: {
            CREATED: "Customer created successfully",
            UPDATED: "Customer updated successfully",
            DELETED: "Customer deactivated successfully",
            FETCHED: "Customer fetched successfully",
            LISTED: "Customers retrieved successfully",
        }
    },
    ERROR: {
        AUTH: {
            MISSING_API_KEY: "Missing or malformed API key",
            INVALID_API_KEY_FORMAT: "Invalid API key format",
            INVALID_API_KEY: "Invalid API key",
        },
        CUSTOMER: {
            NOT_FOUND: "Customer not found",
            ID_REQUIRED: "Customer ID is required",
        },
        COMMON: {
            VALIDATION_ERROR: "Validation Error",
            INTERNAL_SERVER_ERROR: "Internal Server Error",
            ROUTE_NOT_FOUND: "Endpoint not found",
        }
    }
};
