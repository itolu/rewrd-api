import { AppError } from "../utils/AppError";
import { MESSAGES } from "../constants/messages";
import { Request, Response, NextFunction } from "express";
import { customerService } from "../services/customerService";
import { logger } from "../utils/logger";

export const requireCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchantId = req.merchant!.id;
        const { uid } = req.params;

        if (!uid) {
            logger.warn("Customer ID missing in request check", { merchant_id: merchantId, path: req.path });
            return next(new AppError(MESSAGES.ERROR.CUSTOMER.ID_REQUIRED, 400, "customer_id_required"));
        }

        // We can use the service to fetch, but we need to ensure it returns the customer or throws.
        // customerService.getCustomer throws 404 if not found.
        const customer = await customerService.getCustomer(merchantId, uid);

        req.customer = customer;

        next();
    } catch (error) {
        next(error);
    }
};