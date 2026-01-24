import { Knex } from "knex";
import crypto from "crypto";
// Manually defining hashKey to avoid import issues in seed context if paths differ
const hashKey = (key: string): string => {
    return crypto.createHash("sha256").update(key).digest("hex");
};

export async function seed(knex: Knex): Promise<void> {
    // 1. Clear existing entries (optional, careful in prod)
    await knex("ApiKeys").del();
    await knex("Merchants").del();

    // 2. Insert Test Merchant
    const merchantId = "mer_test_123";
    await knex("Merchants").insert({
        merchant_id: merchantId,
        email: "test@rewrd.co",
        password: "hashed_password_stub",
        phone_number: "+1234567890"
    });

    // 3. Insert Test API Key
    const testKey = "sk_test_valid_key";
    await knex("ApiKeys").insert({
        merchant_id: merchantId,
        key_hash: hashKey(testKey),
        prefix: "sk_test",
        env: "test"
    });

    console.log(`Seeded Merchant: ${merchantId}`);
    console.log(`Seeded Key: ${testKey}`);
}
