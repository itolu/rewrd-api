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

export const getIpWhitelist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Use merchantRecord directly — no need for an extra DB query
        const ips = req.merchantRecord.ip_whitelist || [];
        res.status(200).json({
            status: true,
            message: "IP whitelist retrieved successfully",
            data: ips
        });
    } catch (error) {
        next(error);
    }
};

export const updateIpWhitelist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ips = await merchantService.updateIpWhitelist(req.merchantRecord.merchant_id, req.body.ips);
        res.status(200).json({
            status: true,
            message: "IP whitelist updated successfully",
            data: ips
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
