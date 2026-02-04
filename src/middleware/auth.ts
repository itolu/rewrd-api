import { logger } from "../utils/logger";
import crypto from "crypto";
import { db } from "../config/db";
import { AppError } from "../utils/AppError";
import { MESSAGES } from "../constants/messages";
import { Request, Response, NextFunction } from "express";

export const verifyApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new AppError(MESSAGES.ERROR.AUTH.MISSING_API_KEY, 401, "invalid_api_key");
        }

        const apiKey = authHeader.split(" ")[1];

        if (!apiKey.startsWith("sk_live_") && !apiKey.startsWith("sk_test_")) {
            throw new AppError(MESSAGES.ERROR.AUTH.INVALID_API_KEY_FORMAT, 401, "invalid_api_key");
        }

        const hashedKey = hashKey(apiKey);

        // Lookup key in DB
        const keyRecord = await db("ApiKeys")
            .where({ key_hash: hashedKey })
            .first();

        if (!keyRecord) {
            logger.warn("Invalid API key used", { key_prefix: apiKey.substring(0, 10) });
            throw new AppError(MESSAGES.ERROR.AUTH.INVALID_API_KEY, 401, "invalid_api_key");
        }

        // Fetch merchant details to check status
        const merchant = await db("Merchants")
            .where({ merchant_id: keyRecord.merchant_id })
            .first();

        if (!merchant) {
            logger.error("Merchant account not found for valid API key", { merchant_id: keyRecord.merchant_id });
            throw new AppError("Merchant account not found", 401, "merchant_not_found");
        }

        // Check merchant status
        if (merchant.status) {
            if (merchant.status === "inactive") {
                logger.warn("Access attempt by inactive merchant", { merchant_id: merchant.merchant_id, status: merchant.status });
                throw new AppError(
                    MESSAGES.ERROR.AUTH.MERCHANT_INACTIVE,
                    403,
                    "merchant_inactive"
                );
            }

            if (merchant.status === "suspended") {
                logger.warn("Access attempt by suspended merchant", { merchant_id: merchant.merchant_id, status: merchant.status });
                throw new AppError(
                    MESSAGES.ERROR.AUTH.MERCHANT_SUSPENDED,
                    403,
                    "merchant_suspended"
                );
            }

            if (merchant.status === "payment_required") {
                logger.warn("Access attempt by merchant requiring payment", { merchant_id: merchant.merchant_id, status: merchant.status });
                throw new AppError(
                    MESSAGES.ERROR.AUTH.MERCHANT_PAYMENT_REQUIRED,
                    402,
                    "merchant_payment_required"
                );
            }
        }

        // Attach merchant context
        req.merchant = {
            id: keyRecord.merchant_id
        };

        // Log successful authentication (debug level to avoid noise)
        logger.debug("Merchant authenticated successfully", { merchant_id: keyRecord.merchant_id });

        next();
    } catch (error) {
        next(error);
    }
};

export const hashKey = (key: string): string => {
    return crypto.createHash("sha256").update(key).digest("hex");
};
