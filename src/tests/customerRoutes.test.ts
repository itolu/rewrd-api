import request from "supertest";
import app from "../app";
import { customerService } from "../services/customerService";
import { AppError } from "../utils/AppError";

// Mock the Auth middleware to bypass DB check
jest.mock("../middleware/auth", () => ({
    verifyApiKey: (req: any, res: any, next: any) => {
        req.merchant = { id: "mer_test_123" };
        next();
    }
}));

// Mock the CustomerService
jest.mock("../services/customerService");

const mockCustomer = {
    id: "1",
    uid: "cus_123",
    merchant_id: "mer_test_123",
    email: "test@example.com",
    phone_number: "1234567890",
    name: "Test User",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
};

describe("Customer Routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("POST /v1/customers", () => {
        it("should create customer successfully with valid data", async () => {
            (customerService.createOrUpdateCustomer as jest.Mock).mockResolvedValue(mockCustomer);

            const res = await request(app)
                .post("/v1/customers")
                .send({
                    email: "test@example.com",
                    phone_number: "1234567890",
                    name: "Test User"
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(true);
            expect(res.body.data).toEqual({
                ...mockCustomer,
                created_at: mockCustomer.created_at,
                updated_at: mockCustomer.updated_at
            });
            expect(customerService.createOrUpdateCustomer).toHaveBeenCalledWith(expect.objectContaining({
                merchant_id: "mer_test_123",
                email: "test@example.com"
            }));
        });

        it("should return 400 Validation Error if phone_number is missing", async () => {
            const res = await request(app)
                .post("/v1/customers")
                .send({
                    email: "test@example.com"
                    // phone_number missing
                });

            expect(res.status).toBe(400);
            expect(res.body.status).toBe(false);
            expect(res.body.message).toContain("Validation Error");
            // Service should NOT be called
            expect(customerService.createOrUpdateCustomer).not.toHaveBeenCalled();
        });

        it("should return 400 Validation Error if neither email nor phone is provided", async () => {
            // Though schema requires phone_number, the refine check also exists.
            // If we send empty object:
            const res = await request(app)
                .post("/v1/customers")
                .send({});

            expect(res.status).toBe(400);
        });
    });

    describe("GET /v1/customers/:uid", () => {
        it("should return customer details if found", async () => {
            (customerService.getCustomer as jest.Mock).mockResolvedValue(mockCustomer);

            const res = await request(app).get("/v1/customers/cus_123");

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual({
                ...mockCustomer,
                created_at: mockCustomer.created_at,
                updated_at: mockCustomer.updated_at
            });
            expect(customerService.getCustomer).toHaveBeenCalledWith("mer_test_123", "cus_123");
        });

        it("should return 404 if customer not found", async () => {
            (customerService.getCustomer as jest.Mock).mockRejectedValue(new AppError("Customer not found", 404));

            const res = await request(app).get("/v1/customers/cus_999");

            expect(res.status).toBe(404);
            expect(res.body.message).toBe("Customer not found");
        });
    });

    describe("GET /v1/customers", () => {
        it("should list customers with pagination", async () => {
            const mockList = {
                data: [mockCustomer],
                pagination: {
                    page: 1,
                    limit: 50,
                    total: 1,
                    total_pages: 1,
                    has_next: false,
                    has_previous: false
                }
            };
            (customerService.listCustomers as jest.Mock).mockResolvedValue(mockList);

            const res = await request(app).get("/v1/customers?page=1&limit=10");

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.pagination).toBeDefined();
            expect(customerService.listCustomers).toHaveBeenCalledWith(expect.objectContaining({
                merchant_id: "mer_test_123",
                page: 1,
                limit: 10
            }));
        });
    });

    describe("PUT /v1/customers/:uid", () => {
        it("should update customer successfully", async () => {
            const updatedCustomer = { ...mockCustomer, name: "Updated Name" };
            (customerService.updateCustomer as jest.Mock).mockResolvedValue(updatedCustomer);

            const res = await request(app)
                .put("/v1/customers/cus_123")
                .send({ name: "Updated Name" });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe("Updated Name");
            expect(customerService.updateCustomer).toHaveBeenCalledWith(expect.objectContaining({
                merchant_id: "mer_test_123",
                uid: "cus_123",
                name: "Updated Name"
            }));
        });
    });

    describe("DELETE /v1/customers/:uid", () => {
        it("should deactivate customer successfully", async () => {
            (customerService.deleteCustomer as jest.Mock).mockResolvedValue({ message: "Deactivated" });

            const res = await request(app).delete("/v1/customers/cus_123");

            expect(res.status).toBe(200);
            expect(customerService.deleteCustomer).toHaveBeenCalledWith("mer_test_123", "cus_123");
        });
    });
});
