import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    // Use API Key for rate limiting if present, otherwise fallback to IP
    keyGenerator: (req) => {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            return authHeader.split(" ")[1];
        }
        return req.ip || "unknown_ip";
    },
    handler: (req, res, next) => {
        // Use AppError to match our standardized error format
        next(new AppError("Too many requests, please try again later.", 429, "rate_limited"));
    },
    // Optional: Trust proxy if we are behind a load balancer (need to configure app.set('trust proxy', n))
    // we will handle trust proxy setting in app.ts
    validate: false
});
