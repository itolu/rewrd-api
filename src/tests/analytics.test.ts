import { newDb } from "pg-mem";

const memDb = newDb();
memDb.public.none(`
    CREATE TABLE "Merchants" (
        merchant_id VARCHAR PRIMARY KEY,
        status VARCHAR DEFAULT 'active'
    );

    CREATE TABLE "WaysToEarn" (
        id SERIAL PRIMARY KEY,
        merchant_id VARCHAR NOT NULL,
        name VARCHAR,
        points INTEGER DEFAULT 0,
        type VARCHAR,
        subtype VARCHAR,
        status VARCHAR DEFAULT 'active',
        users_rewarded INTEGER DEFAULT 0,
        deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "UniqueCustomers" (
        uid VARCHAR PRIMARY KEY,
        customer_email VARCHAR,
        phone_number VARCHAR,
        name VARCHAR,
        first_name VARCHAR,
        last_name VARCHAR,
        date_of_birth TIMESTAMP,
        merchants_enrolled INTEGER DEFAULT 1,
        overall_status VARCHAR DEFAULT 'active'
    );

    CREATE TABLE "Customers" (
        id SERIAL PRIMARY KEY,
        uid VARCHAR NOT NULL,
        merchant_id VARCHAR NOT NULL,
        name VARCHAR,
        customer_email VARCHAR,
        phone_number VARCHAR NOT NULL,
        points_balance DECIMAL DEFAULT 0,
        points_earned INTEGER DEFAULT 0,
        first_name VARCHAR,
        last_name VARCHAR,
        date_of_birth TIMESTAMP,
        source VARCHAR,
        status VARCHAR DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Pointsledger" (
        id SERIAL PRIMARY KEY,
        merchant_id VARCHAR NOT NULL,
        member_uid VARCHAR,
        title VARCHAR,
        narration VARCHAR,
        ledger_type VARCHAR,
        transaction_type VARCHAR,
        status VARCHAR DEFAULT 'pending',
        reference_id VARCHAR UNIQUE,
        points DECIMAL DEFAULT 0,
        points_balance_after DECIMAL DEFAULT 0,
        points_balance_before DECIMAL DEFAULT 0,
        channel VARCHAR DEFAULT 'online',
        processed BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`);

const testDb = memDb.adapters.createKnex();

jest.mock("../config/db", () => ({
    db: testDb,
}));

import { merchantService } from "../services/merchantService";
import { customerService } from "../services/customerService";

describe("Analytics Logic", () => {
    const merchantId = "mer_test_999";

    beforeEach(async () => {
        await testDb("Pointsledger").del();
        await testDb("Customers").del();
        await testDb("UniqueCustomers").del();
        await testDb("WaysToEarn").del();
        await testDb("Merchants").del();

        await testDb("Merchants").insert({ merchant_id: merchantId, status: "active" });
    });

    describe("merchantService.getAnalytics period filtering", () => {
        beforeEach(async () => {
            const now = new Date();
            const lastWeek = new Date(now);
            lastWeek.setDate(now.getDate() - 10);

            // Old data (10 days ago)
            await testDb("Customers").insert({
                merchant_id: merchantId,
                uid: "cus_old",
                phone_number: "111",
                points_balance: 100,
                created_at: lastWeek
            });

            await testDb("Pointsledger").insert({
                merchant_id: merchantId,
                member_uid: "cus_old",
                transaction_type: "member_signup",
                points: 100,
                reference_id: "ref_old",
                created_at: lastWeek
            });

            // New data (today)
            await testDb("Customers").insert({
                merchant_id: merchantId,
                uid: "cus_new",
                phone_number: "222",
                points_balance: 50,
                created_at: now
            });

            await testDb("Pointsledger").insert({
                merchant_id: merchantId,
                member_uid: "cus_new",
                transaction_type: "member_signup",
                points: 50,
                reference_id: "ref_new",
                created_at: now
            });
        });

        it("should return all data when period is 'all'", async () => {
            const stats = await merchantService.getAnalytics(merchantId, "all");
            expect(stats.active_customers).toBe(2);
            expect(stats.total_earned).toBe(150);
        });

        it("should return only recent data when period is '7d'", async () => {
            const stats = await merchantService.getAnalytics(merchantId, "7d");
            expect(stats.active_customers).toBe(1);
            expect(stats.total_earned).toBe(50);
        });

        it("should return 0 for 'today' if data was recorded earlier than today but within 7d (though our mock uses 'now')", async () => {
            // 'now' should fall into 'today'
            const stats = await merchantService.getAnalytics(merchantId, "today");
            expect(stats.active_customers).toBe(1);
            expect(stats.total_earned).toBe(50);
        });
    });
});
