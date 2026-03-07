import crypto from "crypto";
import { db } from "../config/db";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { redisEventService } from "./redisEventService";

export enum PointsLedgerType {
    CREDIT = "credit",
    DEBIT = "debit"
}

export enum PointsTransactionStatus {
    SUCCESSFUL = "successful",
    PENDING = "pending",
    FAILED = "failed"
}

export interface PointsTransactionInput {
    merchant_id: string;
    customer_uid: string;
    request_id?: string;
    order_id: string;
    order_value: number;
    redeem: boolean;
    reward: boolean;
    deduct_points?: number;
    way_to_earn_id?: number;
}

/**
 * Points Service
 *
 * Delegates points operations to the dashboard backend via Redis pub/sub.
 * The dashboard backend holds the core business logic for:
 *   - Merchant balance validation and deduction
 *   - Customer balance updates
 *   - Ledger entry creation
 *
 * Event types published:
 *   - "points.credit"  → Credit points to a customer
 *   - "points.redeem"  → Debit/redeem points from a customer
 *
 * Direct DB queries:
 *   - getCustomerTransactions → Fetches from Pointsledger table
 */
export class PointsService {
    /**
     * Process a unified point transaction (reward and/or redeem) via the dashboard backend.
     *
     * Publishes a "points.redeemreward" event and waits for the result.
     * The dashboard backend handles:
     *   1. Validating merchant and customer balances
     *   2. Creating necessary ledger entries
     */
    async processTransaction(input: PointsTransactionInput) {
        const { merchant_id, customer_uid, request_id, ...transactionData } = input;

        logger.info("Publishing points.redeemreward event", {
            merchant_id,
            customer_uid,
            order_id: transactionData.order_id,
            redeem: transactionData.redeem,
            reward: transactionData.reward
        });

        const finalRequestId = request_id || crypto.randomUUID();

        const dataPayload = {
            merchant_id,
            member_uid: customer_uid,
            ...transactionData
        };

        const signaturePayload = JSON.stringify({
            event: "points.redeemreward",
            request_id: finalRequestId,
            data: dataPayload
        });

        const signature = crypto.createHmac("sha256", env.REWRD_SIGNATURE_KEY)
            .update(signaturePayload)
            .digest("hex");

        const ledgerEntries = await redisEventService.requestReply("points.redeemreward", {
            event: "points.redeemreward",
            request_id: finalRequestId,
            data: dataPayload,
            signature
        });

        logger.info("Points transaction processed successfully via dashboard backend", {
            merchant_id,
            customer_uid,
            order_id: transactionData.order_id
        });

        return ledgerEntries;
    }

    /**
     * Get transaction history for a customer directly from the database.
     *
     * Queries the Pointsledger table for all entries matching the
     * merchant_id and customer UID, ordered by most recent first.
     */
    async getCustomerTransactions(merchant_id: string, customer_uid: string, page = 1, limit = 50) {
        logger.info("Fetching customer transactions from DB", { merchant_id, customer_uid, page, limit });

        const offset = (page - 1) * limit;

        // Get total count for pagination
        const countResult = await db("Pointsledger")
            .where({ merchant_id, member_uid: customer_uid })
            .count("id as count")
            .first();

        const total = Number(countResult?.count || 0);

        // Get paginated transactions
        const transactions = await db("Pointsledger")
            .where({ merchant_id, member_uid: customer_uid })
            .orderBy("created_at", "desc")
            .limit(limit)
            .offset(offset);

        return {
            transactions,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit),
            },
        };
    }
}

export const pointsService = new PointsService();

