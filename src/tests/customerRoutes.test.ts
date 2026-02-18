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
    first_name: null,
    last_name: null,
    date_of_birth: null,
    status: "active",
    points_balance: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
};

const mockCustomerResponse = {
    uid: "cus_123",
    email: "test@example.com",
    phone_number: "1234567890",
    first_name: null,
    last_name: null,
    date_of_birth: null,
    status: "active",
    points_balance: 0,
    created_at: mockCustomer.created_at
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
                .set("Idempotency-Key", "test-create-customer-001")
                .send({
                    email: "test@example.com",
                    phone_number: "1234567890",
                    name: "Test User"
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(true);
            expect(res.body.data).toEqual(mockCustomerResponse);
            expect(customerService.createOrUpdateCustomer).toHaveBeenCalledWith(expect.objectContaining({
                merchant_id: "mer_test_123",
                email: "test@example.com"
            }));
        });

        it("should succeed with the user's exact reported body", async () => {
            (customerService.createOrUpdateCustomer as jest.Mock).mockResolvedValue(mockCustomer);

            const res = await request(app)
                .post("/v1/customers")
                .set("Idempotency-Key", "user-repro-key")
                .send({
                    "email": "user@example.com",
                    "phone_number": "09092923990",
                    "name": "string",
                    "first_name": "string",
                    "last_name": "string",
                    "date_of_birth": "2026-02-12T04:49:03.933Z"
                });

            console.log("USER REPRO RESPONSE:", JSON.stringify(res.body, null, 2));
            expect(res.status).toBe(200);
        });

        it("should return 400 Validation Error if phone_number is missing", async () => {
            const res = await request(app)
                .post("/v1/customers")
                .set("Idempotency-Key", "test-missing-phone-001")
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
            expect(res.body.data).toEqual(mockCustomerResponse);
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
            expect(res.body.data[0]).toEqual(mockCustomerResponse);
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
            (customerService.getCustomer as jest.Mock).mockResolvedValue(mockCustomer); // Mock existence check
            (customerService.updateCustomer as jest.Mock).mockResolvedValue(updatedCustomer);

            const res = await request(app)
                .put("/v1/customers/cus_123")
                .send({ name: "Updated Name" });

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(mockCustomerResponse); // DTO strips name, so same as base response
            expect(customerService.updateCustomer).toHaveBeenCalledWith(expect.objectContaining({
                merchant_id: "mer_test_123",
                uid: "cus_123",
                name: "Updated Name",
                existingCustomer: expect.anything() // Middleware attaches it
            }));
        });
    });

    describe("PATCH /v1/customers/:uid/restrict", () => {
        it("should restrict customer successfully", async () => {
            (customerService.getCustomer as jest.Mock).mockResolvedValue(mockCustomer); // Mock existence check
            (customerService.restrictCustomer as jest.Mock).mockResolvedValue({ message: "Customer restricted successfully" });

            const res = await request(app).patch("/v1/customers/cus_123/restrict");

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Customer restricted successfully");
            expect(customerService.restrictCustomer).toHaveBeenCalledWith(mockCustomer);
        });

        it("should return 403 if customer is not active", async () => {
            const inactiveCustomer = { ...mockCustomer, status: "inactive" };
            (customerService.getCustomer as jest.Mock).mockResolvedValue(inactiveCustomer);

            const res = await request(app).patch("/v1/customers/cus_123/restrict");

            expect(res.status).toBe(403);
            expect(res.body.message).toBe("Customer is not active");
            expect(customerService.restrictCustomer).not.toHaveBeenCalled();
        });
    });

    describe("PATCH /v1/customers/:uid/unrestrict", () => {
        it("should unrestrict customer successfully", async () => {
            (customerService.getCustomer as jest.Mock).mockResolvedValue(mockCustomer);
            (customerService.unrestrictCustomer as jest.Mock).mockResolvedValue({ message: "Customer unrestricted successfully" });

            const res = await request(app).patch("/v1/customers/cus_123/unrestrict");

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Customer unrestricted successfully");
            expect(customerService.unrestrictCustomer).toHaveBeenCalledWith(mockCustomer);
        });

        it("should succeed even if customer is already active", async () => {
            const activeCustomer = { ...mockCustomer, status: "active" };
            (customerService.getCustomer as jest.Mock).mockResolvedValue(activeCustomer);
            (customerService.unrestrictCustomer as jest.Mock).mockResolvedValue({ message: "Customer unrestricted successfully" });

            const res = await request(app).patch("/v1/customers/cus_123/unrestrict");

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Customer unrestricted successfully");
        });
    });
});
