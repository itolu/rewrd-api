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
        status VARCHAR DEFAULT 'active',
        source VARCHAR,
        points_balance NUMERIC DEFAULT 0,
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

// Mock webhookService to prevent side effects and allow assertion
jest.mock("../services/webhookService", () => ({
    webhookService: {
        sendWebhook: jest.fn(),
    },
}));
import { webhookService } from "../services/webhookService";

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
        it("should return existing local customer (merged with unique data) if found", async () => {
            // Seed data
            await testDb("UniqueCustomers").insert({
                uid: "cus_existing",
                customer_email: input.email,
                phone_number: input.phone_number,
                first_name: input.first_name,
                last_name: input.last_name,
                merchants_enrolled: 1,
            });

            await testDb("Customers").insert({
                merchant_id: input.merchant_id,
                uid: "cus_existing",
            });

            const result = await customerService.createOrUpdateCustomer(input);

            expect(result.uid).toBe("cus_existing");
            expect(result.customer_email).toBe(input.email);
            expect(result.first_name).toBe(input.first_name);
        });

        it("should create new UniqueCustomer and Customer if neither exists", async () => {
            const result = await customerService.createOrUpdateCustomer(input);

            expect(result).toBeDefined();
            // Result is the combined object, so it should have the email
            expect(result.customer_email).toBe(input.email);
            expect(result.phone_number).toBe(input.phone_number);

            // Verify UniqueCustomer was created
            const uniqueCustomer = await testDb("UniqueCustomers")
                .where({ phone_number: input.phone_number }) // Access by phone, not ID since ID is random
                .first();
            expect(uniqueCustomer).toBeDefined();
            expect(uniqueCustomer.merchants_enrolled).toBe(1);

            // Verify Local Customer was created
            const localCustomer = await testDb("Customers")
                .where({ merchant_id: input.merchant_id, uid: uniqueCustomer.uid })
                .first();
            expect(localCustomer).toBeDefined();
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
            // Verify Local Customer was created
            const localCustomer = await testDb("Customers")
                .where({ merchant_id: input.merchant_id, uid: "cus_global_123" })
                .first();
            expect(localCustomer).toBeDefined();
        });

        it("should rollback transaction on error", async () => {
            // This will cause an error due to missing required field (or just force throw in a mocked environment, but here we rely on constraints if any, or logic)
            // Actually, in the code, `phone_number` and `email` are not NOT NULL in the schema defined above, but code might throw.
            // Let's pass null for merchant_id to fail the insert into Customers (it is NOT NULL)
            const invalidInput = { ...input, merchant_id: null as any };

            await expect(customerService.createOrUpdateCustomer(invalidInput))
                .rejects.toThrow();

            // Verify no data was inserted
            const customersCount = await testDb("Customers").count("* as count");
            expect(parseInt(customersCount[0].count)).toBe(0);
        });
    });

    describe("getCustomer", () => {
        it("should return customer with joined details if found", async () => {
            await testDb("UniqueCustomers").insert({
                uid: "cus_123",
                customer_email: "test@example.com",
                phone_number: "1234567890",
                first_name: "Test",
            });

            await testDb("Customers").insert({
                merchant_id: "mer_123",
                uid: "cus_123",
            });

            const result = await customerService.getCustomer("mer_123", "cus_123");

            expect(result.uid).toBe("cus_123");
            expect(result.email).toBe("test@example.com"); // aliased in query
            expect(result.phone_number).toBe("1234567890");
            expect(result.first_name).toBe("Test");
        });

        it("should throw AppError if not found locally", async () => {
            await testDb("UniqueCustomers").insert({
                uid: "cus_123",
                customer_email: "test@example.com",
            });
            // No local customer link

            await expect(customerService.getCustomer("mer_123", "cus_123"))
                .rejects.toThrow("Customer not found");
        });
    });

    describe("updateCustomer", () => {
        it("should update UniqueCustomer fields and return joined customer", async () => {
            await testDb("UniqueCustomers").insert({
                uid: "cus_123",
                customer_email: "old@example.com",
                phone_number: "1234567890",
                first_name: "OldName",
            });

            await testDb("Customers").insert({
                merchant_id: "mer_123",
                uid: "cus_123",
            });

            const result = await customerService.updateCustomer({
                merchant_id: "mer_123",
                uid: "cus_123",
                first_name: "NewName"
            });

            expect(result.first_name).toBe("NewName");

            // Verify DB update
            const unique = await testDb("UniqueCustomers").where({ uid: "cus_123" }).first();
            expect(unique.first_name).toBe("NewName");
        });
    });

    describe("listCustomers", () => {
        it("should return paginated result with joined data", async () => {
            // Seed multiple customers
            await testDb("UniqueCustomers").insert([
                { uid: "cus_1", phone_number: "1111111111", customer_email: "one@test.com" },
                { uid: "cus_2", phone_number: "2222222222", customer_email: "two@test.com" },
            ]);

            await testDb("Customers").insert([
                { merchant_id: "mer_123", uid: "cus_1" },
                { merchant_id: "mer_123", uid: "cus_2" },
            ]);

            const result = await customerService.listCustomers({
                merchant_id: "mer_123",
                page: 1,
                limit: 10,
            });

            expect(result.data.length).toBe(2);
            expect(result.pagination.total).toBe(2);
            expect(result.data[0].email).toBeDefined(); // Check alias
        });

        it("should filter by email (on UniqueCustomers)", async () => {
            await testDb("UniqueCustomers").insert([
                { uid: "cus_1", phone_number: "1111111111", customer_email: "findme@test.com" },
                { uid: "cus_2", phone_number: "2222222222", customer_email: "other@test.com" },
            ]);

            await testDb("Customers").insert([
                { merchant_id: "mer_123", uid: "cus_1" },
                { merchant_id: "mer_123", uid: "cus_2" },
            ]);

            const result = await customerService.listCustomers({
                merchant_id: "mer_123",
                page: 1,
                limit: 10,
                email: "findme"
            });

            expect(result.data.length).toBe(1);
            expect(result.data[0].uid).toBe("cus_1");
        });
    });

    test("restrictCustomer should soft delete customer", async () => {
        const mockCustomer = { id: 1, uid: "cus_123", merchant_id: "mer_123", status: "active" };

        // Insert customer to be deleted
        await testDb("Customers").insert(mockCustomer);

        await customerService.restrictCustomer(mockCustomer);

        const updated = await testDb("Customers").where({ uid: "cus_123" }).first();
        expect(updated.status).toBe("restricted");
    });

    test("unrestrictCustomer should make customer active", async () => {
        const mockCustomer = { id: 1, uid: "cus_123", merchant_id: "mer_123", status: "restricted" };

        // Insert restricted customer
        await testDb("Customers").insert(mockCustomer);

        await customerService.unrestrictCustomer(mockCustomer);

        const updated = await testDb("Customers").where({ uid: "cus_123" }).first();
        expect(updated.status).toBe("active");
    });
});
