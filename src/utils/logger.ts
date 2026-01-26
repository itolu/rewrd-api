import winston from "winston";
import { env } from "../config/env";

const { combine, timestamp, json, colorize, printf } = winston.format;

// Custom format for local development (colorized, reading friendly)
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

export const logger = winston.createLogger({
    level: env.LOG_LEVEL,
    format: combine(timestamp(), json()), // Default to JSON for production
    transports: [
        new winston.transports.Console({
            format:
                env.NODE_ENV === "development"
                    ? combine(colorize(), timestamp({ format: "HH:mm:ss" }), devFormat)
                    : combine(timestamp(), json()),
        }),
    ],
});
