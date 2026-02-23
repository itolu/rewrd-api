import { db } from "../config/db";
import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";
import { MESSAGES } from "../constants/messages";

export class MerchantService {
    /**
     * Get merchant configuration settings
     */
    async getMerchantConfig(merchantRecord: any) {
        logger.debug("Merchant configuration retrieved", { merchant_id: merchantRecord.merchant_id });
        return merchantRecord;
    }

    /**
     * Update merchant configuration settings
     */
    async updateMerchantConfig(merchant_id: string, updates: {
        minimum_threshold_amount?: number;
        point_should_expire?: boolean;
        point_expiration_date?: number;
        last_chance_email_countdown?: number;
        reactivation_email_countdown?: number;
        facebook?: string | null;
        ig_handle?: string | null;
        linked_in?: string | null;
        telegram?: string | null;
        tiktok?: string | null;
        whatsapp?: string | null;
        x_handle?: string | null;
        youtube?: string | null;
        snapchat?: string | null;
    }) {
        logger.info("Updating merchant configuration", {
            merchant_id,
            fields: Object.keys(updates)
        });

        // Security: Prevent updates to critical fields
        const forbiddenFields = ["merchant_id", "password", "pin_hash", "point_balance", "id"];
        const attemptedForbidden = Object.keys(updates).filter(key =>
            forbiddenFields.includes(key)
        );

        if (attemptedForbidden.length > 0) {
            logger.warn("Attempted to update forbidden fields", {
                merchant_id,
                forbidden_fields: attemptedForbidden
            });
            throw new AppError(
                "Cannot update protected fields",
                400,
                "forbidden_field_update"
            );
        }

        // Merchant existence is guaranteed by requireMerchant middleware

        // Track threshold update time
        const updateData: any = {
            ...updates,
            updated_at: new Date()
        };

        if (updates.minimum_threshold_amount !== undefined) {
            updateData.minimum_threshold_updated_at = new Date();
        }

        const [updatedMerchant] = await db("Merchants")
            .where({ merchant_id })
            .update(updateData)
            .returning("*");

        logger.info("Merchant configuration updated", {
            merchant_id,
            updated_fields: Object.keys(updates)
        });

        return updatedMerchant;
    }

    /**
     * Get all active earning rules for a merchant
     */
    async getEarningRules(merchant_id: string) {
        logger.debug("Fetching earning rules", { merchant_id });

        const rules = await db("WaysToEarn")
            .where({ merchant_id, deleted: false, status: "active" })
            .orderBy("created_at", "desc");

        logger.debug("Earning rules retrieved", {
            merchant_id,
            count: rules.length
        });

        return rules;
    }

    /**
     * Get a specific earning rule
     */
    async getEarningRule(merchant_id: string, rule_id: number) {
        logger.debug("Fetching earning rule", { merchant_id, rule_id });

        const rule = await db("WaysToEarn")
            .where({ id: rule_id, merchant_id })
            .first();

        if (!rule) {
            logger.warn("Earning rule not found", { merchant_id, rule_id });
            throw new AppError("Earning rule not found", 404, "rule_not_found");
        }

        logger.debug("Earning rule retrieved", { merchant_id, rule_id });
        return rule;
    }

    /**
     * Get IP whitelist
     */
    async getIpWhitelist(merchant_id: string) {
        const merchant = await db("Merchants")
            .where({ merchant_id })
            .select("ip_whitelist")
            .first();

        return merchant?.ip_whitelist || [];
    }

    /**
     * Update IP whitelist
     */
    async updateIpWhitelist(merchant_id: string, ips: string[]) {
        await db("Merchants")
            .where({ merchant_id })
            .update({
                ip_whitelist: JSON.stringify(ips),
                updated_at: new Date()
            });

        logger.info("Merchant IP whitelist updated", { merchant_id, ip_count: ips.length });
        return ips;
    }

    /**
     * Get Analytics
     */
    async getAnalytics(merchant_id: string, period: string = 'all') {
        const now = new Date();
        let startDate: Date | null = null;

        if (period === 'today') {
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
        } else if (period === '7d') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
        } else if (period === '30d') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);
        }

        // Ledger Statistics (Earned/Redeemed)
        const ledgerQuery = db("Pointsledger").where({ merchant_id });
        if (startDate) {
            ledgerQuery.andWhere('created_at', '>=', startDate);
        }

        const ledgerStats = await ledgerQuery
            .select(
                db.raw("SUM(CASE WHEN transaction_type IN ('member_purchase_order_earned_fixed', 'member_purchase_order_earned_percentage', 'member_signup', 'member_birthday', 'member_anniversary') THEN points ELSE 0 END) as total_earned"),
                db.raw("SUM(CASE WHEN transaction_type = 'member_purchase_order_redeemed' THEN points ELSE 0 END) as total_redeemed")
            )
            .first();

        // New Customers in period
        const customerQuery = db("Customers").where({ merchant_id, status: 'active' });
        if (startDate) {
            customerQuery.andWhere('created_at', '>=', startDate);
        }
        const activeCustomers = await customerQuery.count("id as count").first();

        // Points balance of customers joined/active in period
        const balanceQuery = db("Customers").where({ merchant_id });
        if (startDate) {
            balanceQuery.andWhere('created_at', '>=', startDate);
        }
        const totalBalance = await balanceQuery.sum("points_balance as total").first();

        // Total Transactions in period
        const transactionQuery = db("Pointsledger").where({ merchant_id });
        if (startDate) {
            transactionQuery.andWhere('created_at', '>=', startDate);
        }
        const totalTransactions = await transactionQuery.count("id as count").first();

        return {
            period,
            total_earned: Number(ledgerStats?.total_earned || 0),
            total_redeemed: Number(ledgerStats?.total_redeemed || 0),
            active_customers: Number(activeCustomers?.count || 0),
            total_points_balance: Number(totalBalance?.total || 0),
            total_transactions: Number(totalTransactions?.count || 0)
        };
    }
}

export const merchantService = new MerchantService();
