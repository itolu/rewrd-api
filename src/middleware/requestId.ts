import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export const addRequestId = (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers["x-request-id"] as string) || `req_${randomUUID().replace(/-/g, "")}`;

    // Attach to request object for internal use
    req.headers["x-request-id"] = requestId; // Normalize header

    // Set on response so client sees it
    res.setHeader("X-Request-ID", requestId);

    next();
};
