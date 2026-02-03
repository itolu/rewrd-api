import crypto from "crypto";
import { db } from "../config/db";
import { AppError } from "../utils/AppError";

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

        // 1. Check if customer exists in `Customers` table for this merchant
        const existingLocalCustomer = await db("Customers")
            .where({ merchant_id })
            .andWhere((builder) => {
                if (email) builder.where({ customer_email: email });
                builder.orWhere({ phone_number: phone_number });
            })
            .first();

        if (existingLocalCustomer) {
            // Customer already exists for this merchant, return it (or update if needed - for now just return)
            // We might want to update fields here if provided
            return existingLocalCustomer;
        }

        // 2. Check `UniqueCustomers` (Global check)
        let uniqueCustomer = await db("UniqueCustomers")
            .where((builder) => {
                if (email) builder.where({ customer_email: email });
                builder.orWhere({ phone_number: phone_number });
            })
            .first();

        const trx = await db.transaction();

        try {
            if (!uniqueCustomer) {
                // 3a. Create new UniqueCustomer
                const newUid = `cus_${crypto.randomBytes(8).toString('hex')}`;
                const [createdUnique] = await trx("UniqueCustomers")
                    .insert({
                        uid: newUid,
                        customer_email: email,
                        phone_number: phone_number,
                        name: name || ((first_name && last_name) ? `${first_name} ${last_name}` : null),
                        first_name,
                        last_name,
                        date_of_birth,
                        merchants_enrolled: 1,
                        overall_status: "active",
                    })
                    .returning("*");
                uniqueCustomer = createdUnique;
            } else {
                // 3b. Update existing UniqueCustomer (increment enrolled count)
                await trx("UniqueCustomers")
                    .where({ uid: uniqueCustomer.uid })
                    .increment("merchants_enrolled", 1);
            }

            // 4. Create `Customers` record
            const [newCustomer] = await trx("Customers")
                .insert({
                    merchant_id,
                    uid: uniqueCustomer.uid,
                    customer_email: email || uniqueCustomer.customer_email, // Fallback to unique customer email if null
                    phone_number: phone_number,
                    name: name || uniqueCustomer.name,
                    first_name: first_name || uniqueCustomer.first_name,
                    last_name: last_name || uniqueCustomer.last_name,
                    date_of_birth: date_of_birth || uniqueCustomer.date_of_birth,
                    status: "active",
                    source: "online", // Default or passed in
                })
                .returning("*");

            await trx.commit();
            return newCustomer;

        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }

    async getCustomer(merchant_id: string, uid: string) {
        const customer = await db("Customers")
            .where({ merchant_id, uid })
            .first();

        if (!customer) {
            throw new AppError("Customer not found", 404, "customer_not_found");
        }

        // Optionally join with UniqueCustomers if more data is needed
        // const details = await db("UniqueCustomers").where({ uid }).first();

        return customer;
    }

    async updateCustomer(input: UpdateCustomerInput) {
        const { merchant_id, uid, ...updateData } = input;

        const customer = await db("Customers")
            .where({ merchant_id, uid })
            .first();

        if (!customer) {
            throw new AppError("Customer not found", 404, "customer_not_found");
        }

        // Update Customers table
        const [updatedCustomer] = await db("Customers")
            .where({ id: customer.id })
            .update({
                ...updateData,
                updated_at: new Date(),
            })
            .returning("*");

        // Ideally we should also consider if we update UniqueCustomers. 
        // For now, let's keep them separate or sync critical fields if business logic requires.
        // Syncing names/emails back to UniqueCustomers might be dangerous if other merchants rely on it.
        // So we update only the local merchant view for now.

        return updatedCustomer;
    }

    async listCustomers(filter: ListCustomersFilter) {
        const { merchant_id, page, limit, email, phone_number } = filter;
        const offset = (page - 1) * limit;

        const query = db("Customers").where({ merchant_id });

        if (email) query.where("customer_email", "like", `%${email}%`);
        if (phone_number) query.where("phone_number", "like", `%${phone_number}%`);

        const countQuery = query.clone().count<{ count: string }[]>("id as count").first();
        const dataQuery = query.select("*").limit(limit).offset(offset).orderBy("created_at", "desc");

        const [totalResult, customers] = await Promise.all([countQuery, dataQuery]);

        const total = parseInt(totalResult?.count as string || "0");
        const total_pages = Math.ceil(total / limit);

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

    async deleteCustomer(merchant_id: string, uid: string) {
        // Soft delete or status update? Usually soft delete or inactive
        const customer = await db("Customers")
            .where({ merchant_id, uid })
            .first();

        if (!customer) {
            throw new AppError("Customer not found", 404, "customer_not_found");
        }

        await db("Customers")
            .where({ id: customer.id })
            .update({ status: "inactive", updated_at: new Date() });

        return { message: "Customer deactivated successfully" };
    }
}

export const customerService = new CustomerService();
