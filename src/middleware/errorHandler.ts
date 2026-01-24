import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";
import { randomUUID } from "crypto";

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers["x-request-id"] as string;

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: false,
            message: err.message,
            error: {
                code: err.errorCode,
                request_id: requestId,
                description: err.message,
            },
        });
    }

    // Fallback for unhandled/unknown errors
    console.error("UNKNOWN ERROR:", err);

    // In production, don't leak details
    const message = env.NODE_ENV === "production" ? "Internal Server Error" : err.message;

    return res.status(500).json({
        status: false,
        message,
        error: {
            code: "internal_server_error",
            request_id: requestId,
            description: message,
        },
    });
};
