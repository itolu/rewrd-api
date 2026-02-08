import winston from "winston";
import { env } from "../config/env";

const { combine, timestamp, json, colorize, printf } = winston.format;

// Sensitive keys to mask
const SENSITIVE_KEYS = [
    "password",
    "token",
    "secret",
    "authorization",
    "key",
    "api_key",
    "access_token",
    "refresh_token",
    "pin",
    "cvv",
    "credit_card",
    "email",
    "phone",
    "phone_number"
];

// Recursive masking function
const maskValue = (key: string, value: any): any => {
    if (typeof value === "object" && value !== null) {
        if (Array.isArray(value)) {
            return value.map(item => maskValue(key, item));
        }
        const maskedObj: any = {};
        for (const k in value) {
            maskedObj[k] = maskValue(k, value[k]);
        }
        return maskedObj;
    }

    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
        return "***MASKED***";
    }

    return value;
};

// PII Masking Format
const piiMask = winston.format((info) => {
    // Mask extra metadata
    const { level, message, timestamp, ...metadata } = info;
    const maskedMetadata = maskValue("root", metadata); // "root" checks for nothing, recurses

    // Merge back
    return {
        ...info,
        ...maskedMetadata
    };
});

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
    // Apply PII masking before JSON serialization
    format: combine(timestamp(), piiMask(), json()),
    transports: [
        new winston.transports.Console({
            format:
                env.NODE_ENV === "development"
                    ? combine(colorize(), timestamp({ format: "HH:mm:ss" }), piiMask(), devFormat)
                    : combine(timestamp(), piiMask(), json()),
        }),
    ],
});
