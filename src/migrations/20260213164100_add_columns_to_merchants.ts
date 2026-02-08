import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Merchants", (table) => {
        // Add status column with default value 'active'
        table.enum("status", ["active", "inactive", "suspended", "payment_required"])
            .defaultTo("active")
            .notNullable();

        // Add webhook columns
        table.string("webhook_url").nullable();
        table.string("webhook_secret").nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Merchants", (table) => {
        table.dropColumn("status");
        table.dropColumn("webhook_url");
        table.dropColumn("webhook_secret");
    });
}
