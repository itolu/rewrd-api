import { newDb } from "pg-mem";

// Create in-memory PostgreSQL database BEFORE any other imports
const memDb = newDb();

// Create tables with PostgreSQL syntax
memDb.public.none(`
    CREATE TABLE "UniqueCustomers" (
        uid VARCHAR PRIMARY KEY,
        customer_email VARCHAR,
        phone_number VARCHAR,
        name VARCHAR,
        first_name VARCHAR,
        last_name VARCHAR,
        date_of_birth DATE,
        merchants_enrolled INTEGER DEFAULT 0,
        overall_status VARCHAR DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Customers" (
        id SERIAL PRIMARY KEY,
        uid VARCHAR NOT NULL,
        merchant_id VARCHAR NOT NULL,
        customer_email VARCHAR,
        phone_number VARCHAR NOT NULL,
        name VARCHAR,
        first_name VARCHAR,
        last_name VARCHAR,
        date_of_birth DATE,
        status VARCHAR DEFAULT 'active',
        source VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`);

// Get Knex adapter from pg-mem
const testDb = memDb.adapters.createKnex();

// Mock the db BEFORE importing CustomerService
jest.mock("../config/db", () => ({
    db: testDb,
}));

// NOW import CustomerService (it will use the mocked db)
import { CustomerService } from "../services/customerService";

let customerService: CustomerService;

beforeAll(async () => {
    customerService = new CustomerService();
});

afterAll(async () => {
    if (testDb) {
        await testDb.destroy();
    }
});

beforeEach(async () => {
    // Clean tables before each test
    await testDb("Customers").del();
    await testDb("UniqueCustomers").del();
});

describe("CustomerService", () => {
    const input = {
        merchant_id: "mer_123",
        email: "test@example.com",
        phone_number: "1234567890",
        first_name: "John",
        last_name: "Doe",
    };

    describe("createOrUpdateCustomer", () => {
        it("should return existing local customer if found", async () => {
            // Seed data
            await testDb("UniqueCustomers").insert({
                uid: "cus_existing",
                customer_email: input.email,
                phone_number: input.phone_number,
                merchants_enrolled: 1,
            });

            await testDb("Customers").insert({
                merchant_id: input.merchant_id,
                uid: "cus_existing",
                customer_email: input.email,
                phone_number: input.phone_number,
            });

            const result = await customerService.createOrUpdateCustomer(input);

            expect(result.uid).toBe("cus_existing");
            expect(result.customer_email).toBe(input.email);
        });

        it("should create new UniqueCustomer and Customer if neither exists", async () => {
            const result = await customerService.createOrUpdateCustomer(input);

            expect(result).toBeDefined();
            expect(result.customer_email).toBe(input.email);
            expect(result.phone_number).toBe(input.phone_number);

            // Verify UniqueCustomer was created
            const uniqueCustomer = await testDb("UniqueCustomers")
                .where({ uid: result.uid })
                .first();
            expect(uniqueCustomer).toBeDefined();
            expect(uniqueCustomer.merchants_enrolled).toBe(1);
        });

        it("should link existing UniqueCustomer to new local Customer", async () => {
            // Create existing UniqueCustomer
            await testDb("UniqueCustomers").insert({
                uid: "cus_global_123",
                customer_email: input.email,
                phone_number: input.phone_number,
                merchants_enrolled: 1,
            });

            const result = await customerService.createOrUpdateCustomer(input);

            expect(result.uid).toBe("cus_global_123");

            // Verify merchants_enrolled was incremented
            const uniqueCustomer = await testDb("UniqueCustomers")
                .where({ uid: "cus_global_123" })
                .first();
            expect(uniqueCustomer.merchants_enrolled).toBe(2);
        });

        it("should rollback transaction on error", async () => {
            // This will cause an error due to missing required field
            const invalidInput = { ...input, phone_number: undefined as any };

            await expect(customerService.createOrUpdateCustomer(invalidInput))
                .rejects.toThrow();

            // Verify no data was inserted
            const customersCount = await testDb("Customers").count("* as count");
            expect(parseInt(customersCount[0].count)).toBe(0);
        });
    });

    describe("getCustomer", () => {
        it("should return customer if found", async () => {
            await testDb("UniqueCustomers").insert({
                uid: "cus_123",
                customer_email: "test@example.com",
                phone_number: "1234567890",
            });

            const [customer] = await testDb("Customers").insert({
                merchant_id: "mer_123",
                uid: "cus_123",
                customer_email: "test@example.com",
                phone_number: "1234567890",
            }).returning("*");

            const result = await customerService.getCustomer("mer_123", customer.uid);

            expect(result.uid).toBe(customer.uid);
        });

        it("should throw AppError if not found", async () => {
            await expect(customerService.getCustomer("mer_123", "nonexistent"))
                .rejects.toThrow("Customer not found");
        });
    });

    describe("updateCustomer", () => {
        it("should update and return customer", async () => {
            await testDb("UniqueCustomers").insert({
                uid: "cus_123",
                customer_email: "old@example.com",
                phone_number: "1234567890",
            });

            const [customer] = await testDb("Customers").insert({
                merchant_id: "mer_123",
                uid: "cus_123",
                customer_email: "old@example.com",
                phone_number: "1234567890",
            }).returning("*");

            const result = await customerService.updateCustomer({
                merchant_id: "mer_123",
                uid: customer.uid,
                first_name: "Jane"
            });

            expect(result.first_name).toBe("Jane");
        });

        it("should throw if customer not found", async () => {
            await expect(
                customerService.updateCustomer({ merchant_id: "mer_123", uid: "nonexistent", first_name: "Jane" })
            ).rejects.toThrow("Customer not found");
        });
    });

    describe("listCustomers", () => {
        it("should return paginated result", async () => {
            // Seed multiple customers
            await testDb("UniqueCustomers").insert([
                { uid: "cus_1", phone_number: "1111111111" },
                { uid: "cus_2", phone_number: "2222222222" },
            ]);

            await testDb("Customers").insert([
                { merchant_id: "mer_123", uid: "cus_1", phone_number: "1111111111" },
                { merchant_id: "mer_123", uid: "cus_2", phone_number: "2222222222" },
            ]);

            const result = await customerService.listCustomers({
                merchant_id: "mer_123",
                page: 1,
                limit: 10,
            });

            expect(result.data.length).toBe(2);
            expect(result.pagination.total).toBe(2);
        });
    });

    describe("deleteCustomer", () => {
        it("should soft delete customer", async () => {
            await testDb("UniqueCustomers").insert({
                uid: "cus_123",
                phone_number: "1234567890",
            });

            const [customer] = await testDb("Customers").insert({
                merchant_id: "mer_123",
                uid: "cus_123",
                phone_number: "1234567890",
                status: "active",
            }).returning("*");

            await customerService.deleteCustomer("mer_123", customer.uid);

            const updated = await testDb("Customers")
                .where({ id: customer.id })
                .first();

            expect(updated.status).toBe("inactive");
        });
    });
});
