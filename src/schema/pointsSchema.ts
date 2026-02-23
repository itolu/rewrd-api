import { z } from "zod";

export const creditPointsSchema = z.object({
    body: z.object({
        customer_uid: z.string().min(1, "Customer UID is required"),
        points: z.number().int().positive("Points must be a positive integer"),
        rule_id: z.number().int().positive().optional(),
        narration: z.string().optional(),
        order_id: z.string().optional()
    })
});

export const redeemPointsSchema = z.object({
    body: z.object({
        customer_uid: z.string().min(1, "Customer UID is required"),
        points: z.number().int().positive("Points to redeem must be a positive integer"),
        reward_id: z.string().optional(),
        narration: z.string().optional()
    })
});

export const getTransactionsSchema = z.object({
    params: z.object({
        uid: z.string().min(1, "Customer UID is required")
    }),
    query: z.object({
        page: z.string().optional().transform(v => parseInt(v || "1")),
        limit: z.string().optional().transform(v => parseInt(v || "50"))
    })
});
