import { z } from "zod";

export const createCustomerSchema = z.object({
    body: z.object({
        customer_email: z.string().email("Invalid email format"),
        phone_number: z.string().regex(/^\+234\d{10}$/, "Phone number must be a valid Nigerian number starting with +234 and exactly 14 characters long"),
    }).strict(),
});

export const updateCustomerSchema = z.object({
    params: z.object({
        uid: z.string().min(1, "Customer UID is required"),
    }).strict(),
    body: z.object({
        email: z.string().email().optional(),
        phone_number: z.string().min(10).optional(),
        name: z.string().optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        date_of_birth: z.string().datetime().optional().or(z.date().optional()),
    }).strict(),
});

export const getCustomerSchema = z.object({
    params: z.object({
        uid: z.string().min(1, "Customer UID is required"),
    }).strict(),
});

export const listCustomersSchema = z.object({
    query: z.object({
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
        email: z.string().optional(),
        phone_number: z.string().optional(),
    }).strict(),
});
