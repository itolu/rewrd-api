import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import crypto from "crypto";

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

        // TODO: Implement actual Database verification
        // 1. Hash the apiKey
        // 2. Lookup merchant by hashed key in DB
        // 3. If found, attach to req.merchant

        // STUB: For now, if it looks like a key, we let it pass but don't attach substantial data
        // We will need to update schema.prisma to support API keys first.

        // Mock attachment for development
        req.merchant = {
            id: "stub_merchant_id"
        };

        next();
    } catch (error) {
        next(error);
    }
};

export const hashKey = (key: string): string => {
    return crypto.createHash("sha256").update(key).digest("hex");
};
