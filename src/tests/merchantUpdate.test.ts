import request from "supertest";
import app from "../app";
import { db } from "../config/db";

// Mock database
jest.mock("../config/db", () => {
    const createMockKnex = (): any => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{
            merchant_id: "mer_123",
            point_should_expire: true,
            ig_handle: "https://instagram.com/new_handle"
        }]),
    } as any);

    const mKnex = createMockKnex();
    const mockDb = jest.fn(() => createMockKnex());
    (mockDb as any).raw = jest.fn();
    return { db: mockDb };
});

describe("Merchant Configuration Update", () => {
    const validApiKey = "sk_test_1234567890abcdef12345678";

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock API Key and Merchant for Auth/Status check
        (db as unknown as jest.Mock).mockImplementation((table: string) => {
            if (table === "ApiKeys") {
                return {
                    where: jest.fn().mockReturnThis(),
                    first: jest.fn().mockResolvedValue({
                        merchant_id: "mer_123",
                        key_hash: "any_hash"
                    })
                };
            }
            if (table === "Merchants") {
                return {
                    where: jest.fn().mockReturnThis(),
                    first: jest.fn().mockResolvedValue({
                        merchant_id: "mer_123",
                        status: "active"
                    }),
                    update: jest.fn().mockReturnThis(),
                    returning: jest.fn().mockResolvedValue([{
                        merchant_id: "mer_123",
                        ig_handle: "https://instagram.com/new_handle",
                        point_should_expire: true
                    }])
                };
            }
            return { where: jest.fn().mockReturnThis(), first: jest.fn() };
        });
    });

    it("should successfully update social media fields", async () => {
        const updateData = {
            ig_handle: "https://instagram.com/new_handle",
            facebook: "https://facebook.com/new_page"
        };

        const res = await request(app)
            .patch("/v1/merchant/config")
            .set("Authorization", `Bearer ${validApiKey}`)
            .send(updateData);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
        expect(res.body.data.ig_handle).toBe("https://instagram.com/new_handle");
    });

    it("should return 400 if an unknown field is provided (strict schema)", async () => {
        const updateData = {
            ig_handl: "https://instagram.com/typo", // Typo in field name
            linked_in: "https://linkedin.com/in/correct"
        };

        const res = await request(app)
            .patch("/v1/merchant/config")
            .set("Authorization", `Bearer ${validApiKey}`)
            .send(updateData);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("Validation Error: body - Unrecognized key(s) in object: 'ig_handl'");
    });

    it("should return 400 if invalid URL is provided for social handle", async () => {
        const updateData = {
            ig_handle: "not-a-url"
        };

        const res = await request(app)
            .patch("/v1/merchant/config")
            .set("Authorization", `Bearer ${validApiKey}`)
            .send(updateData);

        expect(res.status).toBe(400);
    });
});
