import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";
import { MESSAGES } from "../constants/messages";
import { Request, Response, NextFunction } from "express";

export const requireActiveCustomer = (req: Request, res: Response, next: NextFunction) => {
    // Ensure customer is present (should be used after requireCustomer)
    if (!req.customer) {
        return next(new AppError(MESSAGES.ERROR.CUSTOMER.NOT_FOUND, 404));
    }

    if (req.customer.status !== "active") {
        logger.warn("Access denied: Customer is not active", { merchant_id: req.merchant?.id, customer_uid: req.customer.uid, status: req.customer.status });
        return next(new AppError(MESSAGES.ERROR.CUSTOMER.NOT_ACTIVE, 403, "customer_not_active"));
    }

    next();
};
