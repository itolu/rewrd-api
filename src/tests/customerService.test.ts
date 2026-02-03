import { db } from "../config/db";
import { AppError } from "../utils/AppError";
import { customerService } from "../services/customerService";

// Helper to create a chainable mock object
const createMockQueryBuilder = () => {
    const builder: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        first: jest.fn(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        increment: jest.fn().mockReturnThis(),
        returning: jest.fn(),
        count: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve([])), // Allow await
    };
    return builder;
};

// Create the mock builder instance
const mockBuilder = createMockQueryBuilder();

// Mock Transaction object
const mockTrx = {
    ...createMockQueryBuilder(),
    commit: jest.fn(),
    rollback: jest.fn(),
};

// Mock knex db function
jest.mock("../config/db", () => ({
    db: jest.fn(() => mockBuilder),
}));

// We also need to mock db.transaction on the db function itself
(db as any).transaction = jest.fn(() => mockTrx);

describe("CustomerService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock implementations for commonly used methods
        mockBuilder.first.mockReset();
        mockBuilder.returning.mockReset();
        mockTrx.insert.mockReturnThis();
        mockTrx.returning.mockReset();
    });

    describe("createOrUpdateCustomer", () => {
        const input = {
            merchant_id: "mer_1",
            email: "test@example.com",
            phone_number: "1234567890",
            first_name: "Test",
            last_name: "User"
        };

        it("should return existing local customer if found", async () => {
            const existing = { id: 1, ...input };
            mockBuilder.first.mockResolvedValueOnce(existing); // Local customer found

            const result = await customerService.createOrUpdateCustomer(input);

            expect(result).toEqual(existing);
            expect(db).toHaveBeenCalledWith("Customers");
            expect(mockBuilder.where).toHaveBeenCalledWith({ merchant_id: "mer_1" });
            // Should NOT verify global or start transaction
            expect(db).not.toHaveBeenCalledWith("UniqueCustomers");
            expect((db as any).transaction).not.toHaveBeenCalled();
        });

        it("should create new UniqueCustomer and Customer if neither exists", async () => {
            mockBuilder.first
                .mockResolvedValueOnce(undefined) // Local not found
                .mockResolvedValueOnce(undefined); // Global not found

            const newUnique = { uid: "cus_new_123", ...input };
            const newCustomer = { id: 1, uid: "cus_new_123", ...input };

            // Transaction inserts
            mockTrx.returning
                .mockResolvedValueOnce([newUnique]) // Unique insert return
                .mockResolvedValueOnce([newCustomer]); // Customer insert return

            const result = await customerService.createOrUpdateCustomer(input);

            expect(result).toEqual(newCustomer);
            expect((db as any).transaction).toHaveBeenCalled();
            // Verify Unique insert
            expect(mockTrx.insert).toHaveBeenCalledWith(expect.objectContaining({
                merchants_enrolled: 1,
                email: undefined // email is mapped to customer_email in logic, check logic
            }));
            expect(mockTrx.commit).toHaveBeenCalled();
        });

        it("should link existing UniqueCustomer to new local Customer", async () => {
            const unique = { uid: "cus_global_123", merchants_enrolled: 1 };

            mockBuilder.first
                .mockResolvedValueOnce(undefined) // Local not found
                .mockResolvedValueOnce(unique);   // Global found

            const newCustomer = { id: 2, uid: "cus_global_123", merchant_id: "mer_1" };

            mockTrx.returning
                .mockResolvedValueOnce([newCustomer]); // Customer insert return

            const result = await customerService.createOrUpdateCustomer(input);

            expect(result).toEqual(newCustomer);
            expect((db as any).transaction).toHaveBeenCalled();
            // Should increment enrolled count
            expect(mockTrx.increment).toHaveBeenCalledWith("merchants_enrolled", 1);
            // Should insert local customer
            expect(mockTrx.insert).toHaveBeenCalledWith(expect.objectContaining({
                uid: "cus_global_123",
                merchant_id: "mer_1"
            }));
            expect(mockTrx.commit).toHaveBeenCalled();
        });

        it("should rollback transaction on error", async () => {
            mockBuilder.first
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);

            // Simulate error during insert
            mockTrx.insert.mockReturnThis();
            mockTrx.returning.mockRejectedValue(new Error("DB Error"));

            await expect(customerService.createOrUpdateCustomer(input))
                .rejects.toThrow("DB Error");

            expect(mockTrx.rollback).toHaveBeenCalled();
        });
    });

    describe("getCustomer", () => {
        it("should return customer if found", async () => {
            const mockCustomer = { id: 1, uid: "cus_123" };
            mockBuilder.first.mockResolvedValue(mockCustomer);

            const result = await customerService.getCustomer("mer_1", "cus_123");
            expect(result).toEqual(mockCustomer);
        });

        it("should throw AppError if not found", async () => {
            mockBuilder.first.mockResolvedValue(undefined);
            await expect(customerService.getCustomer("mer_1", "cus_999"))
                .rejects.toThrow("Customer not found");
        });
    });

    describe("updateCustomer", () => {
        it("should update and return customer", async () => {
            const existing = { id: 1, uid: "cus_123" };
            const updated = { ...existing, name: "New Name" };

            mockBuilder.first.mockResolvedValue(existing);
            mockBuilder.returning.mockResolvedValue([updated]);

            const result = await customerService.updateCustomer({
                merchant_id: "mer_1",
                uid: "cus_123",
                name: "New Name"
            });

            expect(result).toEqual(updated);
            expect(mockBuilder.update).toHaveBeenCalled();
        });

        it("should throw if customer not found", async () => {
            mockBuilder.first.mockResolvedValue(undefined);
            await expect(customerService.updateCustomer({
                merchant_id: "mer_1",
                uid: "cus_999"
            })).rejects.toThrow("Customer not found");
        });
    });

    describe("listCustomers", () => {
        it("should return paginated result", async () => {
            // Count query calls `first`.
            mockBuilder.first.mockResolvedValue({ count: "5" });

            const customers = [{ id: 1 }, { id: 2 }];
            mockBuilder.then.mockImplementation((resolve: any) => resolve(customers));

            const result = await customerService.listCustomers({
                merchant_id: "mer_1",
                page: 1,
                limit: 10
            });

            expect(result.pagination.total).toBe(5);
            expect(result.data).toHaveLength(2);
        });
    });

    describe("deleteCustomer", () => {
        it("should soft delete customer", async () => {
            mockBuilder.first.mockResolvedValue({ id: 1 });
            mockBuilder.update.mockReturnThis();

            const result = await customerService.deleteCustomer("mer_1", "cus_123");

            expect(result.message).toContain("deactivated");
            expect(mockBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ status: "inactive" }));
        });
    });
});
