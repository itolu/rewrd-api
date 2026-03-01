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

    describe("POST /v1/points/credit", () => {
        it("should credit points to a customer", async () => {
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
                .post("/v1/points/credit")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", idempotencyKey)
                .send({
                    customer_uid: customerUid,
                    points: 100
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(true);
            expect(res.body.message).toBe("Points credited successfully");
            expect(res.body.data.ledger_type).toBe("credit");
            expect(Number(res.body.data.points)).toBe(100);

            // Verify the event was published with correct data
            expect(mockRequestReply).toHaveBeenCalledWith("points.credit", expect.objectContaining({
                merchant_id: merchantId,
                customer_uid: customerUid,
                amount: 100,
            }));
        });

        it("should credit points with a rule_id and update rule stats", async () => {
            const idempotencyKey = `key_${crypto.randomUUID()}`;

            // Mock the dashboard backend response
            mockRequestReply.mockResolvedValueOnce({
                id: 2,
                merchant_id: merchantId,
                member_uid: customerUid,
                ledger_type: "credit",
                points: 50,
                title: "Test Fixed Rule",
                status: "successful",
            });

            const res = await request(app)
                .post("/v1/points/credit")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", idempotencyKey)
                .send({
                    customer_uid: customerUid,
                    points: 50,
                    rule_id: ruleId
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(true);
            expect(res.body.data.ledger_type).toBe("credit");
            expect(Number(res.body.data.points)).toBe(50);
            expect(res.body.data.title).toBe("Test Fixed Rule");
        });

        it("should fail with invalid rule_id", async () => {
            const res = await request(app)
                .post("/v1/points/credit")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", `key_${crypto.randomUUID()}`)
                .send({
                    customer_uid: customerUid,
                    points: 10,
                    rule_id: 999999
                });

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe("rule_not_found");
        });

        it("should handle dashboard backend error (e.g. insufficient merchant points)", async () => {
            // Simulate the dashboard backend returning an error
            const { AppError } = require("../utils/AppError");
            mockRequestReply.mockRejectedValueOnce(
                new AppError("Insufficient merchant point balance", 400, "insufficient_merchant_points")
            );

            const res = await request(app)
                .post("/v1/points/credit")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", `key_${crypto.randomUUID()}`)
                .send({
                    customer_uid: customerUid,
                    points: 999999999
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("insufficient_merchant_points");
        });
    });

    describe("POST /v1/points/redeem", () => {
        it("should redeem points from a customer's balance", async () => {
            const idempotencyKey = `key_${crypto.randomUUID()}`;

            // Mock the dashboard backend response
            mockRequestReply.mockResolvedValueOnce({
                id: 3,
                merchant_id: merchantId,
                member_uid: customerUid,
                ledger_type: "debit",
                points: 50,
                points_balance_before: 100,
                points_balance_after: 50,
                status: "successful",
            });

            const res = await request(app)
                .post("/v1/points/redeem")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", idempotencyKey)
                .send({
                    customer_uid: customerUid,
                    points: 50,
                    narration: "Test redemption"
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(true);
            expect(res.body.data.ledger_type).toBe("debit");
            expect(Number(res.body.data.points)).toBe(50);

            // Verify the event was published
            expect(mockRequestReply).toHaveBeenCalledWith("points.redeem", expect.objectContaining({
                merchant_id: merchantId,
                customer_uid: customerUid,
                amount: 50,
            }));
        });

        it("should handle dashboard backend error (e.g. insufficient points)", async () => {
            const { AppError } = require("../utils/AppError");
            mockRequestReply.mockRejectedValueOnce(
                new AppError("Insufficient points balance", 400, "insufficient_points")
            );

            const res = await request(app)
                .post("/v1/points/redeem")
                .set("Authorization", `Bearer ${apiKey}`)
                .set("Idempotency-Key", `key_${crypto.randomUUID()}`)
                .send({
                    customer_uid: customerUid,
                    points: 999999,
                    narration: "Insufficient test"
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("insufficient_points");
        });
    });

    describe("GET /v1/points/customers/:uid/transactions", () => {
        it("should retrieve transaction history", async () => {
            // Mock the dashboard backend response
            mockRequestReply.mockResolvedValueOnce({
                transactions: [
                    { id: 1, ledger_type: "credit", points: 100 },
                    { id: 2, ledger_type: "debit", points: 50 },
                ],
                pagination: { page: 1, limit: 50, total: 2, total_pages: 1 },
            });

            const res = await request(app)
                .get(`/v1/points/customers/${customerUid}/transactions`)
                .set("Authorization", `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.pagination).toBeDefined();

            // Verify the event was published
            expect(mockRequestReply).toHaveBeenCalledWith("points.transactions.list", expect.objectContaining({
                merchant_id: merchantId,
                customer_uid: customerUid,
            }));
        });
    });
});
