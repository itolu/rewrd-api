import type { Knex } from "knex";
import * as dotenv from "dotenv";

dotenv.config();

const config: { [key: string]: Knex.Config } = {
    development: {
        client: "postgresql",
        connection: {
            host: process.env.DB_HOST || "127.0.0.1",
            port: Number(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || "rewrd_db",
            user: process.env.DB_USER || "postgres",
            password: process.env.DB_PASSWORD || "postgres",
        },
        pool: {
            min: 2,
            max: 10,
        },
        migrations: {
            tableName: "knex_migrations",
            directory: "./src/migrations",
            extension: "ts",
        },
        seeds: {
            directory: "./src/seeds",
            extension: "ts",
        },
    },

    production: {
        client: "postgresql",
        connection: {
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            ssl: { rejectUnauthorized: false }
        },
        pool: {
            min: 2,
            max: 10,
        },
        migrations: {
            tableName: "knex_migrations",
            directory: "./src/migrations",
        },
        seeds: {
            directory: "./src/seeds",
        }
    },
};

export default config;
