import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Merchants", (table) => {
        table.jsonb("ip_whitelist").defaultTo("[]");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Merchants", (table) => {
        table.dropColumn("ip_whitelist");
    });
}
