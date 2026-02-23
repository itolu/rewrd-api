import { db } from "../config/db";
import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";
import { webhookService } from "./webhookService";

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

export class PointsService {
    /**
     * Credit points to a customer
     */
    async creditPoints(input: PointsTransactionInput) {
        const { merchant_id, customer_uid, amount, transaction_type, reference_id, title, narration, order_id } = input;

        logger.info("Crediting points", { merchant_id, customer_uid, amount, reference_id });

        return await db.transaction(async (trx) => {
            // 1. Get merchant and lock row for update
            const merchant = await trx("Merchants")
                .where({ merchant_id })
                .forUpdate()
                .first();

            if (!merchant) {
                throw new AppError("Merchant not found", 404, "merchant_not_found");
            }

            const merchantBalance = Number(merchant.point_balance);
            if (merchantBalance < amount) {
                throw new AppError("Insufficient merchant point balance", 400, "insufficient_merchant_points");
            }

            // 2. Get customer and lock row for update
            const customer = await trx("Customers")
                .where({ merchant_id, uid: customer_uid })
                .forUpdate()
                .first();

            if (!customer) {
                throw new AppError("Customer not found", 404, "customer_not_found");
            }

            const pointsBefore = Number(customer.points_balance);
            const pointsAfter = pointsBefore + amount;

            // 3. Deduct from merchant balance
            await trx("Merchants")
                .where({ merchant_id })
                .update({
                    point_balance: merchantBalance - amount,
                    updated_at: new Date()
                });

            // 4. Update customer balance
            await trx("Customers")
                .where({ id: customer.id })
                .update({
                    points_balance: pointsAfter,
                    updated_at: new Date()
                });

            // 3. Create ledger entry
            const [ledgerEntry] = await trx("Pointsledger")
                .insert({
                    merchant_id,
                    member_uid: customer_uid,
                    title,
                    narration,
                    ledger_type: PointsLedgerType.CREDIT,
                    transaction_type,
                    status: PointsTransactionStatus.SUCCESSFUL,
                    reference_id,
                    points: amount,
                    points_balance_before: pointsBefore,
                    points_balance_after: pointsAfter,
                    order_id,
                    processed: true,
                    created_at: new Date(),
                    updated_at: new Date()
                })
                .returning("*");

            logger.info("Points credited successfully", {
                merchant_id,
                customer_uid,
                balance_after: pointsAfter,
                ledger_id: ledgerEntry.id
            });

            return ledgerEntry;
        });
    }

    /**
     * Debit points from a customer
     */
    async debitPoints(input: PointsTransactionInput) {
        const { merchant_id, customer_uid, amount, transaction_type, reference_id, title, narration, order_id } = input;

        logger.info("Debiting points", { merchant_id, customer_uid, amount, reference_id });

        return await db.transaction(async (trx) => {
            // 1. Get merchant and lock row for update
            const merchant = await trx("Merchants")
                .where({ merchant_id })
                .forUpdate()
                .first();

            if (!merchant) {
                throw new AppError("Merchant not found", 404, "merchant_not_found");
            }

            // 2. Get customer and lock row for update
            const customer = await trx("Customers")
                .where({ merchant_id, uid: customer_uid })
                .forUpdate()
                .first();

            if (!customer) {
                throw new AppError("Customer not found", 404, "customer_not_found");
            }

            const pointsBefore = Number(customer.points_balance);

            if (pointsBefore < amount) {
                throw new AppError("Insufficient points balance", 400, "insufficient_points");
            }

            const pointsAfter = pointsBefore - amount;

            // 3. Return points to merchant balance
            await trx("Merchants")
                .where({ merchant_id })
                .update({
                    point_balance: Number(merchant.point_balance) + amount,
                    updated_at: new Date()
                });

            // 4. Update customer balance
            await trx("Customers")
                .where({ id: customer.id })
                .update({
                    points_balance: pointsAfter,
                    updated_at: new Date()
                });

            // 3. Create ledger entry
            const [ledgerEntry] = await trx("Pointsledger")
                .insert({
                    merchant_id,
                    member_uid: customer_uid,
                    title,
                    narration,
                    ledger_type: PointsLedgerType.DEBIT,
                    transaction_type,
                    status: PointsTransactionStatus.SUCCESSFUL,
                    reference_id,
                    points: amount,
                    points_balance_before: pointsBefore,
                    points_balance_after: pointsAfter,
                    order_id,
                    processed: true,
                    created_at: new Date(),
                    updated_at: new Date()
                })
                .returning("*");

            logger.info("Points debited successfully", {
                merchant_id,
                customer_uid,
                balance_after: pointsAfter,
                ledger_id: ledgerEntry.id
            });

            return ledgerEntry;
        });
    }

    /**
     * Get transaction history for a customer
     */
    async getCustomerTransactions(merchant_id: string, customer_uid: string, page = 1, limit = 50) {
        const offset = (page - 1) * limit;

        const [transactions, countResult] = await Promise.all([
            db("Pointsledger")
                .where({ merchant_id, member_uid: customer_uid })
                .orderBy("created_at", "desc")
                .limit(limit)
                .offset(offset),
            db("Pointsledger")
                .where({ merchant_id, member_uid: customer_uid })
                .count("id as count")
                .first()
        ]);

        const total = Number(countResult?.count || 0);

        return {
            transactions,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit)
            }
        };
    }
}

export const pointsService = new PointsService();
