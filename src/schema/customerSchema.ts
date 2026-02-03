import { z } from "zod";

export const createCustomerSchema = z.object({
    body: z.object({
        email: z.string().email().optional().nullable(),
        phone_number: z.string().min(10, "Phone number is required"),
        name: z.string().optional().nullable(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        date_of_birth: z.string().datetime().optional().or(z.date().optional()), // Accept ISO string or Date object
    }).refine((data) => data.email || data.phone_number, {
        message: "Either email or phone number must be provided",
        path: ["email"], // Attach error to email field
    }),
});

export const updateCustomerSchema = z.object({
    params: z.object({
        uid: z.string().min(1, "Customer UID is required"),
    }),
    body: z.object({
        email: z.string().email().optional(),
        phone_number: z.string().min(10).optional(),
        name: z.string().optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        date_of_birth: z.string().datetime().optional().or(z.date().optional()),
    }),
});

export const getCustomerSchema = z.object({
    params: z.object({
        uid: z.string().min(1, "Customer UID is required"),
    }),
});

export const listCustomersSchema = z.object({
    query: z.object({
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
        email: z.string().optional(),
        phone_number: z.string().optional(),
    }),
});
