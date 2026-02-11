import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Merchants", (table) => {
        // Add webhook columns
        table.string("webhook_url").nullable();
        table.string("webhook_secret").nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Merchants", (table) => {
        table.dropColumn("webhook_url");
        table.dropColumn("webhook_secret");
    });
}
