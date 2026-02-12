import { Request, Response, NextFunction } from "express";
import { merchantService } from "../services/merchantService";
import { MESSAGES } from "../constants/messages";
import { toMerchantResponse } from "../dtos/merchant.dto";
import { toRuleResponse } from "../dtos/rule.dto";

export const getMerchantConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await merchantService.getMerchantConfig(req.merchant!.id);
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
        const config = await merchantService.updateMerchantConfig(req.merchant!.id, req.body);
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
        const rules = await merchantService.getEarningRules(req.merchant!.id);
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
        const rule = await merchantService.getEarningRule(req.merchant!.id, Number(req.params.id));
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
        const ips = await merchantService.getIpWhitelist(req.merchant!.id);
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
        const ips = await merchantService.updateIpWhitelist(req.merchant!.id, req.body.ips);
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
        const stats = await merchantService.getAnalytics(req.merchant!.id, req.query.period as string);
        res.status(200).json({
            status: true,
            message: "Analytics retrieved successfully",
            data: stats
        });
    } catch (error) {
        next(error);
    }
};
