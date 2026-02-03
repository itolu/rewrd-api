import crypto from "crypto";
import { db } from "../config/db";
import { AppError } from "../utils/AppError";
import { Request, Response, NextFunction } from "express";

export const verifyApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new AppError("Missing or malformed API key", 401, "invalid_api_key");
        }

        const apiKey = authHeader.split(" ")[1];

        if (!apiKey.startsWith("sk_live_") && !apiKey.startsWith("sk_test_")) {
            throw new AppError("Invalid API key format", 401, "invalid_api_key");
        }

        const hashedKey = hashKey(apiKey);

        // Lookup key in DB
        const keyRecord = await db("ApiKeys")
            .where({ key_hash: hashedKey })
            .first();

        if (!keyRecord) {
            throw new AppError("Invalid API key", 401, "invalid_api_key");
        }

        // Attach merchant context
        req.merchant = {
            id: keyRecord.merchant_id
        };

        // TODO: Async update last_used timestamp if needed

        next();
    } catch (error) {
        next(error);
    }
};

export const hashKey = (key: string): string => {
    return crypto.createHash("sha256").update(key).digest("hex");
};
