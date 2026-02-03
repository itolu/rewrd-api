import { db } from "../config/db";
import { AppError } from "../utils/AppError";
import { customerService } from "../services/customerService";

// Mock knex db
jest.mock("../config/db", () => ({
    db: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        first: jest.fn(),
        transaction: jest.fn(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn(),
        count: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
    })),
}));

// Mock nanoid/crypto logic if feasible, or just test logic flow
// Since we used crypto directly in service, we might mock it or just let it run.

describe("CustomerService", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("getCustomer", () => {
        it("should return customer if found", async () => {
            const mockCustomer = { id: 1, uid: "cus_123", merchant_id: "mer_1" };

            // Setup chain
            const mockWhere = jest.fn().mockReturnThis();
            const mockFirst = jest.fn().mockResolvedValue(mockCustomer);
            (db as unknown as jest.Mock).mockReturnValue({
                where: mockWhere,
                first: mockFirst
            });

            const result = await customerService.getCustomer("mer_1", "cus_123");

            expect(result).toEqual(mockCustomer);
            expect(db).toHaveBeenCalledWith("Customers");
            expect(mockWhere).toHaveBeenCalledWith({ merchant_id: "mer_1", uid: "cus_123" });
        });

        it("should throw AppError if not found", async () => {
            // Setup chain
            const mockWhere = jest.fn().mockReturnThis();
            const mockFirst = jest.fn().mockResolvedValue(undefined);
            (db as unknown as jest.Mock).mockReturnValue({
                where: mockWhere,
                first: mockFirst
            });

            await expect(customerService.getCustomer("mer_1", "cus_999"))
                .rejects.toThrow(AppError);
        });
    });

    // We can add more tests for create, update, list
    // This serves as a basic verification that service is testable and logic holds
});
