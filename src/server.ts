import app from "./app";
import knex from "knex";
import { env } from "./config/env";
import knexConfig from "./knexfile";

const db = knex(knexConfig[env.NODE_ENV]);

// Test DB Connection
db.raw("SELECT 1")
    .then(() => {
        console.log("Database connected successfully");
    })
    .catch((err) => {
        console.error("Database connection failed:", err);
    });

app.listen(env.PORT, () => {
    console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

export { db };
