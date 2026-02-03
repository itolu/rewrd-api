import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";
import { MESSAGES } from "../constants/messages";
import { Request, Response, NextFunction } from "express";

// In-memory storage for idempotency keys
// For production, use Redis with TTL
interface IdempotencyRecord {
    response: {
        status: number;
        body: any;
    };
    createdAt: number;
}

const idempotencyStore = new Map<string, IdempotencyRecord>();

// TTL for idempotency keys (24 hours in milliseconds)
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

/**
 * Middleware to handle idempotent POST requests
 * Requires Idempotency-Key header for all POST requests
 */
export const requireIdempotency = (req: Request, res: Response, next: NextFunction) => {
    // Only apply to POST requests
    if (req.method !== "POST") {
        return next();
    }

    const idempotencyKey = req.headers["idempotency-key"] as string;

    if (!idempotencyKey) {
        logger.warn("Missing Idempotency-Key header on POST request", {
            path: req.path,
            merchant_id: req.merchant?.id
        });
        return next(new AppError(
            MESSAGES.ERROR.COMMON.IDEMPOTENCY_KEY_REQUIRED,
            400,
            "idempotency_key_required"
        ));
    }

    // Validate key format (alphanumeric, hyphens, underscores, 1-100 chars)
    const keyPattern = /^[a-zA-Z0-9_-]{1,100}$/;
    if (!keyPattern.test(idempotencyKey)) {
        logger.warn("Invalid Idempotency-Key format", {
            key: idempotencyKey,
            merchant_id: req.merchant?.id
        });
        return next(new AppError(
            MESSAGES.ERROR.COMMON.INVALID_IDEMPOTENCY_KEY,
            400,
            "invalid_idempotency_key"
        ));
    }

    // Scope key to merchant to prevent cross-merchant collisions
    const scopedKey = `${req.merchant?.id}:${idempotencyKey}`;

    // Check if we've seen this key before
    const existing = idempotencyStore.get(scopedKey);

    if (existing) {
        const age = Date.now() - existing.createdAt;

        // Check if key is still valid (within TTL)
        if (age > IDEMPOTENCY_TTL) {
            // Key expired, remove it and continue
            idempotencyStore.delete(scopedKey);
            logger.debug("Expired idempotency key removed", {
                key: idempotencyKey,
                age_hours: (age / (60 * 60 * 1000)).toFixed(2)
            });
        } else {
            // Key is still valid, return cached response
            logger.info("Idempotent request detected, returning cached response", {
                key: idempotencyKey,
                merchant_id: req.merchant?.id,
                age_seconds: (age / 1000).toFixed(2)
            });

            return res.status(existing.response.status).json(existing.response.body);
        }
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to capture response
    res.json = function (body: any) {
        // Store response for this idempotency key
        idempotencyStore.set(scopedKey, {
            response: {
                status: res.statusCode,
                body
            },
            createdAt: Date.now()
        });

        logger.debug("Stored idempotency key", {
            key: idempotencyKey,
            status: res.statusCode,
            merchant_id: req.merchant?.id
        });

        // Call original json method
        return originalJson(body);
    };

    next();
};

/**
 * Cleanup expired idempotency keys
 * Run this periodically (e.g., every hour)
 */
export const cleanupExpiredKeys = () => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of idempotencyStore.entries()) {
        const age = now - record.createdAt;
        if (age > IDEMPOTENCY_TTL) {
            idempotencyStore.delete(key);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.info("Cleaned up expired idempotency keys", { count: cleaned });
    }

    return cleaned;
};

// Start cleanup interval (every hour)
// Use unref() to prevent hanging in test environments
const cleanupInterval = setInterval(cleanupExpiredKeys, 60 * 60 * 1000);
cleanupInterval.unref();

