import crypto from "crypto";
import { db } from "../config/db";
import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";
import { pointsService } from "../services/pointsService";
import { Request, Response, NextFunction } from "express";
import { webhookService } from "../services/webhookService";

export const creditPoints = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchant_id = req.merchant!.id;
        const { customer_uid, points, rule_id, narration, order_id } = req.body;

        let title = "Points Credit";
        let transactionType = "member_points_adjustment_credit";

        // If rule_id is provided, validate it
        if (rule_id) {
            const rule = await db("WaysToEarn")
                .where({ id: rule_id, merchant_id, status: "active", deleted: false })
                .first();

            if (!rule) {
                throw new AppError("Earning rule not found or inactive", 404, "rule_not_found");
            }

            title = rule.name || "Rule Credit";
            transactionType = rule.earning_type === "percentage_off"
                ? "member_purchase_order_earned_percentage"
                : "member_purchase_order_earned_fixed";

            // Increment rule usage (non-critical)
            db("WaysToEarn")
                .where({ id: rule_id })
                .increment("users_rewarded", 1)
                .catch(err => logger.error("Failed to update rule usage stats", { rule_id, error: err.message }));
        }

        const ledger = await pointsService.creditPoints({
            merchant_id,
            customer_uid,
            amount: points,
            transaction_type: transactionType,
            reference_id: `credit_${crypto.randomUUID()}`,
            title,
            narration: narration || `Credited ${points} points`,
            order_id
        });

        // Fire webhook
        webhookService.sendWebhook(merchant_id, "points.earned", {
            customer_uid,
            points,
            rule_id: rule_id || null,
            ledger_id: ledger.id
        });

        return res.status(200).json({
            status: true,
            message: "Points credited successfully",
            data: ledger
        });
    } catch (error) {
        next(error);
    }
};

export const redeemPoints = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchant_id = req.merchant!.id;
        const { customer_uid, points, narration, reward_id } = req.body;

        const ledger = await pointsService.debitPoints({
            merchant_id,
            customer_uid,
            amount: points,
            transaction_type: "member_purchase_order_redeemed",
            reference_id: `redeem_${crypto.randomUUID()}`,
            title: "Point Redemption",
            narration: narration || `Redeemed ${points} points`,
            metadata: { reward_id }
        });

        // Fire webhook
        webhookService.sendWebhook(merchant_id, "points.redeemed", {
            customer_uid,
            points,
            reward_id,
            ledger_id: ledger.id
        });

        return res.status(200).json({
            status: true,
            message: "Points redeemed successfully",
            data: ledger
        });
    } catch (error) {
        next(error);
    }
};

export const getCustomerTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchant_id = req.merchant!.id;
        const { uid } = req.params;
        const { page, limit } = req.query;

        const result = await pointsService.getCustomerTransactions(
            merchant_id,
            uid,
            Number(page),
            Number(limit)
        );

        return res.status(200).json({
            status: true,
            message: "Transactions retrieved successfully",
            data: result.transactions,
            pagination: result.pagination
        });
    } catch (error) {
        next(error);
    }
};
