import crypto from "crypto";
import { db } from "../config/db";
import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";
import { pointsService } from "../services/pointsService";
import { Request, Response, NextFunction } from "express";
import { webhookService } from "../services/webhookService";
import { toPointsTransactionResponse } from "../dtos/points.dto";

export const processPointsTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchant_id = req.merchant!.id;
        const {
            customer_uid,
            order_id,
            order_value,
            redeem,
            reward,
            deduct_points,
            way_to_earn_id
        } = req.body;

        // If a reward transaction, optionally validate the earning rule
        if (reward && way_to_earn_id) {
            const rule = await db("WaysToEarn")
                .where({ id: way_to_earn_id, merchant_id, status: "active", deleted: false })
                .first();

            if (!rule) {
                throw new AppError("Earning rule not found or inactive", 404, "rule_not_found");
            }
        }

        const request_id = req.headers["x-request-id"] as string | undefined;

        const ledgerEntries = await pointsService.processTransaction({
            merchant_id,
            customer_uid,
            request_id,
            order_id,
            order_value,
            redeem,
            reward,
            deduct_points,
            way_to_earn_id
        });

        // Fire appropriate webhooks based on boolean flags
        if (reward && ledgerEntries) {
            webhookService.sendWebhook(merchant_id, "points.earned", {
                customer_uid,
                order_id,
                order_value,
                rule_id: way_to_earn_id || null,
            });
        }

        if (redeem && ledgerEntries) {
            webhookService.sendWebhook(merchant_id, "points.redeemed", {
                customer_uid,
                order_id,
                order_value,
                deduct_points,
            });
        }

        return res.status(200).json({
            status: true,
            message: "Transaction processed successfully",
            data: ledgerEntries
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
            data: result.transactions.map(toPointsTransactionResponse),
            pagination: result.pagination
        });
    } catch (error) {
        next(error);
    }
};
