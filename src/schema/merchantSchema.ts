import { z } from "zod";

export const updateConfigSchema = z.object({
    body: z.object({
        minimum_threshold_amount: z.number().min(0).optional(),
        point_should_expire: z.boolean().optional(),
        point_expiration_date: z.number().min(1).max(3650).optional(),
        last_chance_email_countdown: z.number().min(1).max(90).optional(),
        reactivation_email_countdown: z.number().min(1).max(90).optional(),
        sender_name: z.string().max(100).optional(),
        reply_to_email: z.string().email().optional(),
        billing_email: z.string().email().optional(),
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

export const updateIpWhitelistSchema = z.object({
    body: z.object({
        ips: z.array(z.string().ip({ version: "v4" })).min(1, "At least one IP is required")
    }).strict()
});

export const getAnalyticsSchema = z.object({
    query: z.object({
        period: z.enum(['today', '7d', '30d', 'all']).optional().default('all')
    }).strict()
});
