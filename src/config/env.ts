import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("3000"),
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.string().default("5432"),
    DB_NAME: z.string().default("rewrd_db"),
    DB_USER: z.string().default("postgres"),
    DB_PASSWORD: z.string().default("postgres"),
});

export const env = envSchema.parse(process.env);
