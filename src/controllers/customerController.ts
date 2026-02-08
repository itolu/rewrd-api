import { MESSAGES } from "../constants/messages";
import { getPagination } from "../utils/pagination";
import { Request, Response, NextFunction } from "express";
import { toCustomerResponse } from "../dtos/customer.dto";
import { customerService } from "../services/customerService";
import { logger } from "../utils/logger";

export const createOrUpdateCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchantId = req.merchant!.id;
        logger.info("Customer creation request", { merchant_id: merchantId });

        const customer = await customerService.createOrUpdateCustomer({
            merchant_id: merchantId,
            ...req.body
        });

        res.status(200).json({
            status: true,
            message: MESSAGES.SUCCESS.CUSTOMER.CREATED,
            data: toCustomerResponse(customer),
        });
    } catch (error) {
        next(error);
    }
};

export const getCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        logger.debug("Customer fetch request", { merchant_id: req.merchant!.id, customer_uid: req.customer.uid });
        // req.customer is populated by requireCustomer middleware
        res.status(200).json({
            status: true,
            message: MESSAGES.SUCCESS.CUSTOMER.FETCHED,
            data: toCustomerResponse(req.customer),
        });
    } catch (error) {
        next(error);
    }
};

export const listCustomers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchantId = req.merchant!.id;
        const { page, limit } = getPagination(req.query);
        const { email, phone_number } = req.query;

        const result = await customerService.listCustomers({
            merchant_id: merchantId,
            page,
            limit,
            email: email as string,
            phone_number: phone_number as string,
        });

        res.status(200).json({
            status: true,
            message: MESSAGES.SUCCESS.CUSTOMER.LISTED,
            data: result.data.map(toCustomerResponse),
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchantId = req.merchant!.id;
        const { uid } = req.params;

        // Middleware already verified existence
        const updated = await customerService.updateCustomer({
            merchant_id: merchantId,
            uid,
            existingCustomer: req.customer,
            ...req.body
        });

        res.status(200).json({
            status: true,
            message: MESSAGES.SUCCESS.CUSTOMER.UPDATED,
            data: toCustomerResponse(updated),
        });
    } catch (error) {
        next(error);
    }
};

export const restrictCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await customerService.restrictCustomer(req.customer);

        res.status(200).json({
            status: true,
            message: MESSAGES.SUCCESS.CUSTOMER.RESTRICTED,
        });
    } catch (error) {
        next(error);
    }
};

export const unrestrictCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await customerService.unrestrictCustomer(req.customer);

        res.status(200).json({
            status: true,
            message: MESSAGES.SUCCESS.CUSTOMER.UNRESTRICTED,
        });
    } catch (error) {
        next(error);
    }
};