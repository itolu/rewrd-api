import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default("3001"),
    PUBLIC_URL: z.string().optional(),
    DB_PORT: z.string().default("5432"),
    DB_NAME: z.string().default("rewrd_db"),
    DB_USER: z.string().default("postgres"),
    DB_HOST: z.string().default("localhost"),
    DB_PASSWORD: z.string().default("postgres"),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    SWAGGER_ROUTE_SECRET: z.string().default("api-docs-hidden"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    LOG_LEVEL: z.enum(["error", "warn", "info", "http", "verbose", "debug", "silly"]).default("info"),
});

export const env = envSchema.parse(process.env);
