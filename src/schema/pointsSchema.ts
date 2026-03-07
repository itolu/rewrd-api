import { z } from "zod";

export const transactionSchema = z.object({
    body: z.object({
        customer_uid: z.string().min(1, "Customer UID is required"),
        order_id: z.string().min(1, "Order ID is required"),
        order_value: z.number().positive("Order value must be positive"),
        redeem: z.boolean(),
        reward: z.boolean(),
        deduct_points: z.number().int().positive().optional(),
        way_to_earn_id: z.number().int().positive().optional()
    }).refine((data) => !(data.redeem) || data.deduct_points !== undefined, {
        message: "deduct_points is required when redeem is true",
        path: ["deduct_points"]
    }).refine((data) => !(data.reward) || data.way_to_earn_id !== undefined, {
        message: "way_to_earn_id is required when reward is true",
        path: ["way_to_earn_id"]
    }).refine((data) => data.redeem || data.reward, {
        message: "At least one of 'redeem' or 'reward' must be true",
        path: ["redeem"]
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
