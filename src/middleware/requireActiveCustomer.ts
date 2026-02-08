import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { MESSAGES } from "../constants/messages";

export const requireActiveCustomer = (req: Request, res: Response, next: NextFunction) => {
    // Ensure customer is present (should be used after requireCustomer)
    if (!req.customer) {
        return next(new AppError(MESSAGES.ERROR.CUSTOMER.NOT_FOUND, 404));
    }

    if (req.customer.status !== "active") {
        return next(new AppError(MESSAGES.ERROR.CUSTOMER.NOT_ACTIVE, 403, "customer_not_active"));
    }

    next();
};
