import request from "supertest";
import app from "../app";
import { db } from "../config/db";
import { hashKey } from "../middleware/auth";
import crypto from "crypto";

// Mock the Redis event service so tests don't need a real Redis connection
jest.mock("../services/redisEventService", () => {
    const mockRequestReply = jest.fn();
    const mockFireAndForget = jest.fn();
    return {
        redisEventService: {
            initialize: jest.fn().mockResolvedValue(undefined),
            requestReply: mockRequestReply,
            fireAndForget: mockFireAndForget,
            pendingCount: 0,
            shutdown: jest.fn(),
        },
        RedisEventService: jest.fn(),
    };
});

// Mock Redis config to prevent actual Redis connections
jest.mock("../config/redis", () => ({
    connectRedis: jest.fn().mockResolvedValue(false),
    disconnectRedis: jest.fn().mockResolvedValue(undefined),
    redisPublisher: { status: "wait", on: jest.fn(), connect: jest.fn(), quit: jest.fn() },
    redisSubscriber: { status: "wait", on: jest.fn(), connect: jest.fn(), quit: jest.fn(), subscribe: jest.fn() },
}));

import { redisEventService } from "../services/redisEventService";

const mockRequestReply = redisEventService.requestReply as jest.MockedFunction<typeof redisEventService.requestReply>;

describe("Points Module", () => {
    let apiKey: string;
    let merchantId: string;
    let customerUid: string;
    let ruleId: number;

    beforeAll(async () => {
        // 1. Create a fresh test merchant
        merchantId = `mer_test_${crypto.randomBytes(4).toString("hex")}`;
        await db("Merchants").insert({
            merchant_id: merchantId,
            email: `${merchantId}@test.com`,
            full_name: "Test Merchant",
            phone_number: "2348000000000",
            password: "hashed_password",
            point_balance: 100000,
            id: Math.floor(Math.random() * 1000000)
        });

        // 2. Create API key for this merchant
        apiKey = `sk_test_${crypto.randomBytes(16).toString("hex")}`;
        const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");

        await db("ApiKeys").insert({
            merchant_id: merchantId,
            key_hash: hashedKey,
            prefix: "sk_test_",
            env: "test"
        });

        // 3. Create a test customer (Unique and Merchant-specific)
        customerUid = `cus_test_${crypto.randomBytes(4).toString("hex")}`;

        await db("UniqueCustomers").insert({
            uid: customerUid,
            customer_email: `${customerUid}@test.com`,
            phone_number: `+234${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            first_name: "Test",
            last_name: "User"
        });

        await db("Customers").insert({
            merchant_id: merchantId,
            uid: customerUid,
            phone_number: "2349000000000",
            customer_email: `${customerUid}@test.com`,
            points_balance: 0,
            status: "active"
        });

        // 4. Create an earning rule
        const [rule] = await db("WaysToEarn").insert({
            merchant_id: merchantId,
            name: "Test Fixed Rule",
            points: 100,
            type: "task",
            subtype: "order",
            status: "active",
            earning_type: "fixed"
        }).returning("*");

        ruleId = rule.id;
    });

    afterAll(async () => {
        // Cleanup all records created for this merchant
        await db("ApiKeys").where({ merchant_id: merchantId }).delete();
        await db("WaysToEarn").where({ merchant_id: merchantId }).delete();
        await db("Pointsledger").where({ merchant_id: merchantId }).delete();
        await db("Customers").where({ merchant_id: merchantId }).delete();
        await db("UniqueCustomers").where({ uid: customerUid }).delete();
        await db("Merchants").where({ merchant_id: merchantId }).delete();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("POST /v1/points/transaction", () => {
        it("should process a reward-only transaction", async () => {
            const idempotencyKey = `key_${crypto.randomUUID()}`;

            // Mock the dashboard backend response
            mockRequestReply.mockResolvedValueOnce({
                id: 1,
                merchant_id: merchantId,
                member_uid: customerUid,
                ledger_type: "credit",
                points: 100,
                points_balance_before: 0,
                points_balance_after: 100,
                status: "successful",
            });

            const res = await request(app)
                .post("/v1/points/transaction")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", idempotencyKey)
                .send({
                    customer_uid: customerUid,
                    order_id: "ORD-001",
                    order_value: 10000,
                    redeem: false,
                    reward: true,
                    way_to_earn_id: ruleId
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(true);
            expect(res.body.message).toBe("Transaction processed successfully");

            // Verify the event was published with correct data
            expect(mockRequestReply).toHaveBeenCalledWith("points.redeemreward", expect.objectContaining({
                event: "points.redeemreward",
                data: expect.objectContaining({
                    merchant_id: merchantId,
                    member_uid: customerUid,
                    order_id: "ORD-001",
                    order_value: 10000,
                    redeem: false,
                    reward: true,
                    way_to_earn_id: ruleId
                }),
                signature: expect.any(String)
            }));
        });

        it("should process a redeem-only transaction", async () => {
            const idempotencyKey = `key_${crypto.randomUUID()}`;

            mockRequestReply.mockResolvedValueOnce({
                id: 2,
                merchant_id: merchantId,
                member_uid: customerUid,
                ledger_type: "debit",
                points: 50,
                points_balance_before: 100,
                points_balance_after: 50,
                status: "successful",
            });

            const res = await request(app)
                .post("/v1/points/transaction")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", idempotencyKey)
                .send({
                    customer_uid: customerUid,
                    order_id: "ORD-002",
                    order_value: 5000,
                    redeem: true,
                    reward: false,
                    deduct_points: 50
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(true);

            expect(mockRequestReply).toHaveBeenCalledWith("points.redeemreward", expect.objectContaining({
                event: "points.redeemreward",
                data: expect.objectContaining({
                    merchant_id: merchantId,
                    member_uid: customerUid,
                    redeem: true,
                    reward: false,
                    deduct_points: 50
                })
            }));
        });

        it("should process a simultaneous reward & redeem transaction", async () => {
            mockRequestReply.mockResolvedValueOnce([
                { id: 3, ledger_type: "debit", points: 200 },
                { id: 4, ledger_type: "credit", points: 50 }
            ]);

            const res = await request(app)
                .post("/v1/points/transaction")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", `key_${crypto.randomUUID()}`)
                .send({
                    customer_uid: customerUid,
                    order_id: "ORD-003",
                    order_value: 10000,
                    redeem: true,
                    reward: true,
                    deduct_points: 200,
                    way_to_earn_id: ruleId
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);

            expect(mockRequestReply).toHaveBeenCalledWith("points.redeemreward", expect.objectContaining({
                event: "points.redeemreward",
                data: expect.objectContaining({
                    redeem: true,
                    reward: true,
                })
            }));
        });

        it("should fail validation if reward is true but way_to_earn_id is missing", async () => {
            const res = await request(app)
                .post("/v1/points/transaction")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", `key_${crypto.randomUUID()}`)
                .send({
                    customer_uid: customerUid,
                    order_id: "ORD-004",
                    order_value: 10000,
                    redeem: false,
                    reward: true
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain("way_to_earn_id is required");
        });

        it("should fail validation if redeem is true but deduct_points is missing", async () => {
            const res = await request(app)
                .post("/v1/points/transaction")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", `key_${crypto.randomUUID()}`)
                .send({
                    customer_uid: customerUid,
                    order_id: "ORD-005",
                    order_value: 10000,
                    redeem: true,
                    reward: false
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain("deduct_points is required");
        });

        it("should fail with invalid rule_id for reward", async () => {
            const res = await request(app)
                .post("/v1/points/transaction")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", `key_${crypto.randomUUID()}`)
                .send({
                    customer_uid: customerUid,
                    order_id: "ORD-006",
                    order_value: 10000,
                    redeem: false,
                    reward: true,
                    way_to_earn_id: 999999
                });

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe("rule_not_found");
        });

        it("should handle dashboard backend error (e.g. insufficient points)", async () => {
            const { AppError } = require("../utils/AppError");
            mockRequestReply.mockRejectedValueOnce(
                new AppError("Insufficient points balance", 400, "insufficient_points")
            );

            const res = await request(app)
                .post("/v1/points/transaction")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", `key_${crypto.randomUUID()}`)
                .send({
                    customer_uid: customerUid,
                    order_id: "ORD-007",
                    order_value: 5000,
                    redeem: true,
                    reward: false,
                    deduct_points: 99999
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("insufficient_points");
        });
    });

    describe("GET /v1/points/customers/:uid/transactions", () => {
        beforeAll(async () => {
            // Seed ledger rows for the test customer
            await db("Pointsledger").insert([
                {
                    merchant_id: merchantId,
                    member_uid: customerUid,
                    ledger_type: "credit",
                    transaction_type: "member_points_adjustment_credit",
                    points: 100,
                    reference_id: `ref_tx_${crypto.randomUUID()}`,
                    title: "Points Credit",
                    status: "successful",
                },
                {
                    merchant_id: merchantId,
                    member_uid: customerUid,
                    ledger_type: "debit",
                    transaction_type: "member_purchase_order_redeemed",
                    points: 50,
                    reference_id: `ref_tx_${crypto.randomUUID()}`,
                    title: "Point Redemption",
                    status: "successful",
                },
            ]);
        });

        it("should retrieve transaction history from the database", async () => {
            const res = await request(app)
                .get(`/v1/points/customers/${customerUid}/transactions`)
                .set("Authorization", `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(2);
            expect(res.body.pagination).toBeDefined();
            expect(res.body.pagination.total).toBe(2);
            expect(res.body.pagination.total_pages).toBe(1);
        });

        it("should paginate transaction results", async () => {
            const res = await request(app)
                .get(`/v1/points/customers/${customerUid}/transactions?page=1&limit=1`)
                .set("Authorization", `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.pagination.total).toBe(2);
            expect(res.body.pagination.total_pages).toBe(2);
        });

        it("should return 404 if customer not found", async () => {
            const res = await request(app)
                .get("/v1/points/customers/non_existent_uid/transactions")
                .set("Authorization", `Bearer ${apiKey}`);

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe("customer_not_found");
        });
    });
});
