import request from "supertest";
import app from "../app";
import { db } from "../config/db";
import { hashKey } from "../middleware/auth";

// Mock database
jest.mock("../config/db", () => {
    const mKnex = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn(),
        clone: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
    } as any;
    const mockDb = jest.fn(() => mKnex);
    return { db: mockDb };
});

describe("Merchant Status Enforcement", () => {
    const validApiKey = "sk_test_1234567890abcdef12345678";
    const hashedValidKey = "mocked_hashed_key";

    // Setup for typical valid key lookup
    const setupValidKey = () => {
        (db as unknown as jest.Mock).mockImplementation((table: string) => {
            if (table === "ApiKeys") {
                return {
                    where: jest.fn().mockReturnThis(),
                    first: jest.fn().mockResolvedValue({
                        merchant_id: "mer_123",
                        key_hash: hashedValidKey
                    })
                };
            }
            if (table === "Merchants") {
                // Default merchant lookup mock - overridden in tests
                return {
                    where: jest.fn().mockReturnThis(),
                    first: jest.fn().mockResolvedValue({
                        merchant_id: "mer_123",
                        status: "active" // Default active
                    })
                };
            }
            return {
                where: jest.fn().mockReturnThis(),
                first: jest.fn(),
                select: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
            };
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset hashKey if mocked, but we imported real hashKey so we mock internal crypto or just rely on mocked DB response matching whatever hashKey produces?
        // Actually, verifyApiKey hashes the input key.
        // We'll mock the specific DB response to match whatever verifyApiKey produces for validApiKey, OR we just trust the flow.
        // It's easier to mock the DB response to return a record REGARDLESS of the hash value for "ApiKeys" lookup *if possible*, 
        // but knex chaining makes that tricky.
        // Let's refine the mock implementation per test case.
    });

    // Helper to mock specific status
    const mockMerchantStatus = (status: string | undefined) => {
        (db as unknown as jest.Mock).mockImplementation((table: string) => {
            if (table === "ApiKeys") {
                return {
                    where: jest.fn().mockReturnThis(),
                    first: jest.fn().mockResolvedValue({
                        merchant_id: "mer_123",
                        key_hash: "any_hash" // The actual hash value check happens in the query constraint, but here we mock the result
                    })
                };
            }
            if (table === "Merchants") {
                return {
                    where: jest.fn().mockReturnThis(),
                    first: jest.fn().mockResolvedValue({
                        merchant_id: "mer_123",
                        status: status
                    })
                };
            }
            return { where: jest.fn().mockReturnThis(), first: jest.fn().mockReturnThis() };
        });
    };

    it("should allow access when merchant status is active", async () => {
        mockMerchantStatus("active");

        const res = await request(app)
            .get("/v1/customers")
            .set("Authorization", `Bearer ${validApiKey}`);

        // If status is active, we expect 200 (or 404/empty list), but definitely NOT 401/402/403
        // Since we mocked DB returns for customers? We didn't. 
        // So it might fail later in controller.
        // We check specific error codes.
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(402);
    });

    it("should allow access when merchant status is undefined (legacy support)", async () => {
        mockMerchantStatus(undefined);

        const res = await request(app)
            .get("/v1/customers")
            .set("Authorization", `Bearer ${validApiKey}`);

        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(402);
    });

    it("should deny access when merchant is inactive", async () => {
        mockMerchantStatus("inactive");

        const res = await request(app)
            .get("/v1/customers")
            .set("Authorization", `Bearer ${validApiKey}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("merchant_inactive");
    });

    it("should deny access when merchant is suspended", async () => {
        mockMerchantStatus("suspended");

        const res = await request(app)
            .get("/v1/customers")
            .set("Authorization", `Bearer ${validApiKey}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("merchant_suspended");
    });

    it("should deny access with payment required when status is payment_required", async () => {
        mockMerchantStatus("payment_required");

        const res = await request(app)
            .get("/v1/customers")
            .set("Authorization", `Bearer ${validApiKey}`);

        expect(res.status).toBe(402);
        expect(res.body.error.code).toBe("merchant_payment_required");
    });
});
