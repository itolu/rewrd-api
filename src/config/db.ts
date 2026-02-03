import knex from "knex";
import { env } from "./env";
import knexConfig from "../knexfile";

export const db = knex(knexConfig[env.NODE_ENV]);

// Optional: Log connection status if not in test mode
if (env.NODE_ENV !== 'test') {
    db.raw("SELECT 1")
        .then(() => {
            console.log("Database connected successfully");
        })
        .catch((err) => {
            console.error("Database connection failed:", err);
        });
}
