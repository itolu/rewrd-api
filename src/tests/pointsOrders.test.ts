import request from "supertest";
import app from "../app";
import { db } from "../config/db";
import { hashKey } from "../middleware/auth";
import crypto from "crypto";

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

    describe("POST /v1/points/credit", () => {
        it("should credit points to a customer", async () => {
            const idempotencyKey = `key_${crypto.randomUUID()}`;

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

            // Verify customer balance increased
            const customer = await db("Customers").where({ uid: customerUid }).first();
            expect(Number(customer.points_balance)).toBe(100);

            // Verify merchant balance decreased
            const merchant = await db("Merchants").where({ merchant_id: merchantId }).first();
            expect(Number(merchant.point_balance)).toBe(99900);
        });

        it("should credit points with a rule_id and update rule stats", async () => {
            const idempotencyKey = `key_${crypto.randomUUID()}`;

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

        it("should fail if merchant has insufficient point balance", async () => {
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

            // Get current balance
            const customerBefore = await db("Customers").where({ uid: customerUid }).first();
            const balanceBefore = Number(customerBefore.points_balance);

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

            // Verify balance update
            const customerAfter = await db("Customers").where({ uid: customerUid }).first();
            expect(Number(customerAfter.points_balance)).toBe(balanceBefore - 50);
        });

        it("should fail if customer has insufficient points", async () => {
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
            const res = await request(app)
                .get(`/v1/points/customers/${customerUid}/transactions`)
                .set("Authorization", `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.pagination).toBeDefined();
        });
    });
});
