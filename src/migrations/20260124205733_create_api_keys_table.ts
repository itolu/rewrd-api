import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable("ApiKeys", (table) => {
        table.increments("id").primary();
        table.string("merchant_id").notNullable().references("merchant_id").inTable("Merchants").onDelete("CASCADE");
        table.string("key_hash").notNullable().unique();
        table.string("prefix").notNullable(); // 'sk_live' or 'sk_test'
        table.string("env").notNullable(); // 'live' or 'test'
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("last_used").nullable();

        table.index(["key_hash"]);
        table.index(["merchant_id"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("ApiKeys");
}
