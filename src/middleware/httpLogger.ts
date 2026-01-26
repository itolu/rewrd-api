import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

// Define sensitive keys to mask
const SENSITIVE_KEYS = ["password", "token", "authorization", "cvv", "credit_card", "secret", "pin_hash", "hash"];
const PARTIAL_KEYS = ["email", "phone_number"];

// Recursive sanitization function
const sanitize = (obj: any): any => {
    if (!obj) return obj;
    if (typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
        return obj.map(sanitize);
    }

    const sanitized: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const lowerKey = key.toLowerCase();
            const value = obj[key];

            if (SENSITIVE_KEYS.some((k) => lowerKey.includes(k))) {
                sanitized[key] = "***MASKED***";
            } else if (PARTIAL_KEYS.some((k) => lowerKey.includes(k)) && typeof value === "string") {
                // Simple partial mask: show first 3 chars
                sanitized[key] = value.length > 3 ? `${value.substring(0, 3)}***` : "***MASKED***";
            } else if (typeof value === "object") {
                sanitized[key] = sanitize(value);
            } else {
                sanitized[key] = value;
            }
        }
    }
    return sanitized;
};

export const httpLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestId = req.headers["x-request-id"] || "unknown_req_id";

    // Log Request
    logger.info(`Incoming ${req.method} ${req.url}`, {
        type: "request",
        request_id: requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        user_agent: req.headers["user-agent"],
        body: sanitize(req.body),
    });

    // Intercept Response send/json
    const originalSend = res.send;
    // const originalJson = res.json; // Express uses send internally for json, so intercepting send usually catches both, but let's be safe.

    // We only hook into `res.send` to capture the body chunks
    let responseBody: any;

    res.send = function (body): Response {
        responseBody = body;
        return originalSend.apply(this, arguments as any);
    };

    // On finish, log response
    res.on("finish", () => {
        const duration = Date.now() - start;

        let parsedBody = responseBody;
        try {
            if (typeof responseBody === "string") {
                parsedBody = JSON.parse(responseBody);
            }
        } catch (e) {
            // Not JSON, keep as is
        }

        logger.info(`Outgoing ${res.statusCode} ${req.method} ${req.url}`, {
            type: "response",
            request_id: requestId,
            status: res.statusCode,
            duration: `${duration}ms`,
            body: sanitize(parsedBody),
        });
    });

    next();
};
