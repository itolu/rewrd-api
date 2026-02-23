import crypto from "crypto";
import { db } from "../config/db";
import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";
import { webhookService } from "./webhookService";

// Define input types for better type safety
interface CreateCustomerInput {
    merchant_id: string;
    email: string | null;
    phone_number: string;
    name?: string | null;
    first_name?: string;
    last_name?: string;
    date_of_birth?: Date;
}

interface UpdateCustomerInput {
    merchant_id: string;
    uid: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: Date;
    phone_number?: string;
    email?: string;
    existingCustomer?: any; // Optional pre-fetched customer
}

interface ListCustomersFilter {
    merchant_id: string;
    page: number;
    limit: number;
    email?: string;
    phone_number?: string;
}

export class CustomerService {
    /**
     * Create or Update a customer.
     * Logic:
     * 1. Check if customer exists in `Customers` table for this merchant.
     * 2. If not, check `UniqueCustomers` (global).
     * 3. Link or create `UniqueCustomers` record.
     * 4. Create `Customers` record linked to `UniqueCustomers`.
     */
    async createOrUpdateCustomer(input: CreateCustomerInput) {
        const { merchant_id, email, phone_number, name, first_name, last_name, date_of_birth } = input;

        logger.info("Creating or updating customer", {
            merchant_id,
            phone_number,
            has_email: !!email,
        });

        // 1. Check `UniqueCustomers` (Global check)
        let uniqueCustomer = await db("UniqueCustomers")
            .where((builder) => {
                if (email) builder.where({ customer_email: email });
                builder.orWhere({ phone_number: phone_number });
            })
            .first();

        // 2. If unique customer exists, check if they are already linked to this merchant
        let existingLocalCustomer = null;
        if (uniqueCustomer) {
            existingLocalCustomer = await db("Customers")
                .where({ merchant_id, uid: uniqueCustomer.uid })
                .first();
        }

        if (existingLocalCustomer) {
            logger.info("Found existing local customer", {
                merchant_id,
                customer_uid: existingLocalCustomer.uid,
                phone_number,
            });

            // Return combined data (local + unique)
            return {
                ...existingLocalCustomer,
                ...uniqueCustomer // Spread unique details (name, email, etc.)
            };
        }

        const trx = await db.transaction();

        try {
            if (!uniqueCustomer) {
                logger.info("Creating new UniqueCustomer", {
                    merchant_id,
                    phone_number,
                });
                // 3a. Create new UniqueCustomer
                const newUid = `cus_${crypto.randomBytes(8).toString('hex')}`;
                const [createdUnique] = await trx("UniqueCustomers")
                    .insert({
                        uid: newUid,
                        customer_email: email,
                        phone_number: phone_number,
                        first_name,
                        last_name,
                        date_of_birth,
                        overall_status: "active",
                    })
                    .returning("*");
                uniqueCustomer = createdUnique;
            } else {
                logger.info("Linking to existing UniqueCustomer", {
                    merchant_id,
                    customer_uid: uniqueCustomer.uid
                });
                // 3b. Existing UniqueCustomer - no update needed for merchants_enrolled as it's deprecated
            }

            // 4. Create `Customers` record (ONLY merchant-specific fields)
            const [newCustomer] = await trx("Customers")
                .insert({
                    merchant_id,
                    uid: uniqueCustomer.uid,
                    // customer_email, phone_number, name, etc removed from here
                    status: "active",
                    source: "online",
                })
                .returning("*");

            await trx.commit();

            // Fire webhook asynchronously
            // We combine data for the webhook payload
            const webhookPayload = { ...newCustomer, ...uniqueCustomer };
            webhookService.sendWebhook(merchant_id, "customer.created", webhookPayload);

            return webhookPayload;

        } catch (error) {
            await trx.rollback();
            logger.error("Error creating customer, transaction rolled back", {
                merchant_id,
                phone_number,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async getCustomer(merchant_id: string, uid: string) {
        logger.debug("Fetching customer", { merchant_id, customer_uid: uid });

        const customer = await db("Customers")
            .join("UniqueCustomers", "Customers.uid", "UniqueCustomers.uid")
            .where({ "Customers.merchant_id": merchant_id, "Customers.uid": uid })
            .select("Customers.*", "UniqueCustomers.first_name", "UniqueCustomers.last_name", "UniqueCustomers.customer_email as email", "UniqueCustomers.phone_number", "UniqueCustomers.date_of_birth")
            .first();

        if (!customer) {
            logger.warn("Customer not found", { merchant_id, customer_uid: uid });
            throw new AppError("Customer not found", 404, "customer_not_found");
        }

        logger.debug("Customer found", { merchant_id, customer_uid: uid });

        return customer;
    }

    async updateCustomer(input: UpdateCustomerInput) {
        const { merchant_id, uid, existingCustomer, ...updateData } = input;

        logger.info("Updating customer", { merchant_id, customer_uid: uid });

        // Identify which fields belong to UniqueCustomers (global) and which to Customers (local)
        // For now, names/emails/dob are global (UniqueCustomers).
        const uniqueUpdates: any = {};
        if (updateData.first_name !== undefined) uniqueUpdates.first_name = updateData.first_name;
        if (updateData.last_name !== undefined) uniqueUpdates.last_name = updateData.last_name;
        if (updateData.date_of_birth !== undefined) uniqueUpdates.date_of_birth = updateData.date_of_birth;
        if (updateData.phone_number !== undefined) uniqueUpdates.phone_number = updateData.phone_number;
        if (updateData.email !== undefined) uniqueUpdates.customer_email = updateData.email;

        const trx = await db.transaction();

        try {
            // Update UniqueCustomers if we have relevant fields
            if (Object.keys(uniqueUpdates).length > 0) {
                await trx("UniqueCustomers")
                    .where({ uid })
                    .update({
                        ...uniqueUpdates,
                        // updated_at? UniqueCustomers might not have updated_at or strict audit
                    });
            }

            // Update local Customers table (if we had any local fields - currently mostly status/points which aren't in this input usually)
            // But we always update updated_at
            const [updatedCustomer] = await trx("Customers")
                .where({ merchant_id, uid })
                .update({
                    updated_at: new Date(),
                })
                .returning("*");

            await trx.commit();

            // Re-fetch full joined object for return
            return await this.getCustomer(merchant_id, uid);

        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }

    async listCustomers(filter: ListCustomersFilter) {
        const { merchant_id, page, limit, email, phone_number } = filter;
        const offset = (page - 1) * limit;

        logger.debug("Listing customers", { merchant_id, page, limit, has_email_filter: !!email, has_phone_filter: !!phone_number });

        // Base query function to ensure clean state
        const getBaseQuery = () => {
            const query = db("Customers")
                .join("UniqueCustomers", "Customers.uid", "UniqueCustomers.uid")
                .where({ "Customers.merchant_id": merchant_id });

            if (email) query.where("UniqueCustomers.customer_email", "like", `%${email}%`);
            if (phone_number) query.where("UniqueCustomers.phone_number", "like", `%${phone_number}%`);

            return query;
        };

        const countQuery = getBaseQuery().count<{ count: string }[]>("Customers.id as count").first();
        const dataQuery = getBaseQuery()
            .select("Customers.*", "UniqueCustomers.first_name", "UniqueCustomers.last_name", "UniqueCustomers.customer_email as email", "UniqueCustomers.phone_number", "UniqueCustomers.date_of_birth")
            .limit(limit)
            .offset(offset)
            .orderBy("Customers.created_at", "desc");

        const [totalResult, customers] = await Promise.all([countQuery, dataQuery]);

        const total = parseInt(totalResult?.count as string || "0");
        const total_pages = Math.ceil(total / limit);

        logger.debug("Customers listed", { merchant_id, page, limit, total, returned: customers.length });

        return {
            data: customers,
            pagination: {
                page,
                limit,
                total,
                total_pages,
                has_next: page < total_pages,
                has_previous: page > 1,
            },
        };
    }

    async restrictCustomer(customer: any) {
        logger.info("Restricting customer", { merchant_id: customer.merchant_id, customer_uid: customer.uid });

        await db("Customers")
            .where({ id: customer.id })
            .update({ status: "restricted", updated_at: new Date() });

        logger.info("Customer restricted successfully", { merchant_id: customer.merchant_id, customer_uid: customer.uid, customer_id: customer.id });

        // Fire webhook
        webhookService.sendWebhook(customer.merchant_id, "customer.restricted", {
            uid: customer.uid,
            id: customer.id,
            status: "restricted",
            restricted_at: new Date()
        });

        return { message: "Customer restricted successfully" };
    }

    async unrestrictCustomer(customer: any) {
        logger.info("Unrestricting customer", { merchant_id: customer.merchant_id, customer_uid: customer.uid });

        await db("Customers")
            .where({ id: customer.id })
            .update({ status: "active", updated_at: new Date() });

        logger.info("Customer unrestricted successfully", { merchant_id: customer.merchant_id, customer_uid: customer.uid, customer_id: customer.id });

        // Fire webhook
        webhookService.sendWebhook(customer.merchant_id, "customer.unrestricted", {
            uid: customer.uid,
            id: customer.id,
            status: "active",
            unrestricted_at: new Date()
        });

        return { message: "Customer unrestricted successfully" };
    }
}

export const customerService = new CustomerService();
