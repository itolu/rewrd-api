import { MESSAGES } from "../constants/messages";
import { toRuleResponse } from "../dtos/rule.dto";
import { Request, Response, NextFunction } from "express";
import { toMerchantResponse } from "../dtos/merchant.dto";
import { merchantService } from "../services/merchantService";

export const getMerchantConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await merchantService.getMerchantConfig(req.merchantRecord);
        res.status(200).json({
            status: true,
            message: MESSAGES.MERCHANT.CONFIG_FETCHED,
            data: toMerchantResponse(config)
        });
    } catch (error) {
        next(error);
    }
};

export const updateMerchantConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await merchantService.updateMerchantConfig(req.merchantRecord.merchant_id, req.body);
        res.status(200).json({
            status: true,
            message: MESSAGES.MERCHANT.CONFIG_UPDATED,
            data: toMerchantResponse(config)
        });
    } catch (error) {
        next(error);
    }
};

export const getEarningRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rules = await merchantService.getEarningRules(req.merchantRecord.merchant_id);
        res.status(200).json({
            status: true,
            message: MESSAGES.MERCHANT.RULES_FETCHED,
            data: rules.map(toRuleResponse)
        });
    } catch (error) {
        next(error);
    }
};

export const getEarningRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rule = await merchantService.getEarningRule(req.merchantRecord.merchant_id, Number(req.params.id));
        res.status(200).json({
            status: true,
            message: MESSAGES.MERCHANT.RULE_FETCHED,
            data: toRuleResponse(rule)
        });
    } catch (error) {
        next(error);
    }
};

export const getMerchantIps = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ips = await merchantService.getMerchantIps(req.merchantRecord.merchant_id);
        res.status(200).json({
            status: true,
            message: "Merchant IPs retrieved successfully",
            data: ips
        });
    } catch (error) {
        next(error);
    }
};

export const addMerchantIp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ip = await merchantService.addMerchantIp(req.merchantRecord.merchant_id, req.body);
        res.status(201).json({
            status: true,
            message: "Merchant IP added successfully",
            data: ip
        });
    } catch (error) {
        next(error);
    }
};

export const updateMerchantIp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ip = await merchantService.updateMerchantIp(req.merchantRecord.merchant_id, Number(req.params.id), req.body);
        res.status(200).json({
            status: true,
            message: "Merchant IP updated successfully",
            data: ip
        });
    } catch (error) {
        next(error);
    }
};

export const deleteMerchantIp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await merchantService.deleteMerchantIp(req.merchantRecord.merchant_id, Number(req.params.id));
        res.status(200).json({
            status: true,
            message: "Merchant IP deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

export const getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await merchantService.getAnalytics(req.merchantRecord.merchant_id, req.query.period as string);
        res.status(200).json({
            status: true,
            message: "Analytics retrieved successfully",
            data: stats
        });
    } catch (error) {
        next(error);
    }
};
