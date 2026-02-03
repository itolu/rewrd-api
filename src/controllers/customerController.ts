import { MESSAGES } from "../constants/messages";
import { Request, Response, NextFunction } from "express";
import { customerService } from "../services/customerService";

export const createOrUpdateCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchantId = req.merchant!.id;
        const customer = await customerService.createOrUpdateCustomer({
            merchant_id: merchantId,
            ...req.body
        });

        res.status(200).json({
            status: true,
            message: MESSAGES.SUCCESS.CUSTOMER.CREATED,
            data: customer,
        });
    } catch (error) {
        next(error);
    }
};

export const getCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchantId = req.merchant!.id;
        const { uid } = req.params;

        const customer = await customerService.getCustomer(merchantId, uid);

        res.status(200).json({
            status: true,
            data: customer,
        });
    } catch (error) {
        next(error);
    }
};

export const listCustomers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchantId = req.merchant!.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
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
            ...result, // data and pagination
        });
    } catch (error) {
        next(error);
    }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchantId = req.merchant!.id;
        const { uid } = req.params;

        const updated = await customerService.updateCustomer({
            merchant_id: merchantId,
            uid,
            ...req.body
        });

        res.status(200).json({
            status: true,
            message: MESSAGES.SUCCESS.CUSTOMER.UPDATED,
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchantId = req.merchant!.id;
        const { uid } = req.params;

        await customerService.deleteCustomer(merchantId, uid);

        res.status(200).json({
            status: true,
            message: MESSAGES.SUCCESS.CUSTOMER.DELETED,
        });
    } catch (error) {
        next(error);
    }
};
