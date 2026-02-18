import { db } from "../config/db";
import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";
import { MESSAGES } from "../constants/messages";
import { Request, Response, NextFunction } from "express";

export const requireMerchant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchantId = req.merchant!.id;

        const merchant = await db("Merchants")
            .where({ merchant_id: merchantId })
            .first();

        if (!merchant) {
            logger.warn("Merchant not found", { merchant_id: merchantId });
            return next(new AppError(MESSAGES.MERCHANT.NOT_FOUND, 404, "merchant_not_found"));
        }

        req.merchantRecord = merchant;

        next();
    } catch (error) {
        next(error);
    }
};
