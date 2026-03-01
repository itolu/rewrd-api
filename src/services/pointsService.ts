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
    amount: number;
    transaction_type: string;
    reference_id: string;
    title: string;
    narration?: string;
    order_id?: string;
    metadata?: any;
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
 *   - "points.transactions.list" → Fetch transaction history
 */
export class PointsService {
    /**
     * Credit points to a customer via the dashboard backend.
     *
     * Publishes a "points.credit" event and waits for the result.
     * The dashboard backend is expected to:
     *   1. Validate merchant has sufficient point balance
     *   2. Deduct from merchant balance
     *   3. Add to customer balance
     *   4. Create a ledger entry
     *   5. Return the ledger entry
     */
    async creditPoints(input: PointsTransactionInput) {
        const { merchant_id, customer_uid, amount, reference_id } = input;

        logger.info("Publishing points.credit event", { merchant_id, customer_uid, amount, reference_id });

        const ledgerEntry = await redisEventService.requestReply("points.credit", {
            merchant_id,
            customer_uid,
            amount,
            transaction_type: input.transaction_type,
            reference_id,
            title: input.title,
            narration: input.narration,
            order_id: input.order_id,
        });

        logger.info("Points credited successfully via dashboard backend", {
            merchant_id,
            customer_uid,
            ledger_id: ledgerEntry?.id,
        });

        return ledgerEntry;
    }

    /**
     * Debit/redeem points from a customer via the dashboard backend.
     *
     * Publishes a "points.redeem" event and waits for the result.
     * The dashboard backend is expected to:
     *   1. Validate customer has sufficient points
     *   2. Deduct from customer balance
     *   3. Return points to merchant balance
     *   4. Create a ledger entry
     *   5. Return the ledger entry
     */
    async debitPoints(input: PointsTransactionInput) {
        const { merchant_id, customer_uid, amount, reference_id } = input;

        logger.info("Publishing points.redeem event", { merchant_id, customer_uid, amount, reference_id });

        const ledgerEntry = await redisEventService.requestReply("points.redeem", {
            merchant_id,
            customer_uid,
            amount,
            transaction_type: input.transaction_type,
            reference_id,
            title: input.title,
            narration: input.narration,
            order_id: input.order_id,
            metadata: input.metadata,
        });

        logger.info("Points debited successfully via dashboard backend", {
            merchant_id,
            customer_uid,
            ledger_id: ledgerEntry?.id,
        });

        return ledgerEntry;
    }

    /**
     * Get transaction history for a customer via the dashboard backend.
     *
     * Publishes a "points.transactions.list" event and waits for the result.
     * The dashboard backend returns { transactions, pagination }.
     */
    async getCustomerTransactions(merchant_id: string, customer_uid: string, page = 1, limit = 50) {
        logger.info("Publishing points.transactions.list event", { merchant_id, customer_uid, page, limit });

        const result = await redisEventService.requestReply("points.transactions.list", {
            merchant_id,
            customer_uid,
            page,
            limit,
        });

        return result;
    }
}

export const pointsService = new PointsService();

