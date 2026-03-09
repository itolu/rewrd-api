import { z } from "zod";

export const updateConfigSchema = z.object({
    body: z.object({
        minimum_threshold_amount: z.number().min(0).optional(),
        point_should_expire: z.boolean().optional(),
        point_expiration_date: z.number().min(1).max(3650).optional(),
        last_chance_email_countdown: z.number().min(1).max(90).optional(),
        reactivation_email_countdown: z.number().min(1).max(90).optional(),
        facebook: z.string().url().optional().or(z.literal("")),
        ig_handle: z.string().url().optional().or(z.literal("")),
        linked_in: z.string().url().optional().or(z.literal("")),
        telegram: z.string().url().optional().or(z.literal("")),
        tiktok: z.string().url().optional().or(z.literal("")),
        whatsapp: z.string().url().optional().or(z.literal("")),
        x_handle: z.string().url().optional().or(z.literal("")),
        youtube: z.string().url().optional().or(z.literal("")),
        snapchat: z.string().url().optional().or(z.literal("")),
    }).strict().refine(data => Object.keys(data).length > 0, {
        message: "At least one field must be provided"
    })
});

export const getRuleSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/).transform(Number)
    }).strict()
});

export const addMerchantIpSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required"),
        ip_address: z.string().ip({ version: "v4", message: "Invalid IPv4 address" }).or(z.string().ip({ version: "v6", message: "Invalid IPv6 address" })),
        ip_type: z.enum(["ipv4", "ipv6"]).optional()
    }).strict()
});

export const updateMerchantIpSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/).transform(Number)
    }).strict(),
    body: z.object({
        name: z.string().min(1).optional(),
        ip_address: z.string().ip({ version: "v4" }).or(z.string().ip({ version: "v6" })).optional(),
        ip_type: z.enum(["ipv4", "ipv6"]).optional(),
        status: z.enum(["active", "inactive"]).optional()
    }).strict().refine(data => Object.keys(data).length > 0, {
        message: "At least one field must be provided"
    })
});

export const deleteMerchantIpSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/).transform(Number)
    }).strict()
});

export const getAnalyticsSchema = z.object({
    query: z.object({
        period: z.enum(['today', '7d', '30d', 'all']).optional().default('all')
    }).strict()
});
