import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("MerchantIP", (table) => {
        table.increments("id").primary();
        table.string("merchant_id").notNullable().references("merchant_id").inTable("Merchants").onDelete("CASCADE");
        table.string("name").notNullable();
        table.string("ip_address").notNullable();
        table.enum("ip_type", ["ipv4", "ipv6"], { useNative: true, enumName: "MerchantIPType" }).notNullable().defaultTo("ipv4");
        table.enum("status", ["active", "inactive"], { useNative: true, enumName: "MerchantIPStatus" }).notNullable().defaultTo("active");
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());

        table.index(["merchant_id"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("MerchantIP");

    await knex.raw('DROP TYPE IF EXISTS "MerchantIPType" CASCADE');
    await knex.raw('DROP TYPE IF EXISTS "MerchantIPStatus" CASCADE');
}
