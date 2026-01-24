/// <reference path="./types/express.d.ts" />
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { verifyApiKey } from "./middleware/auth";
import { addRequestId } from "./middleware/requestId";
import { apiLimiter } from "./middleware/rateLimiter";
import { AppError } from "./utils/AppError";

const app = express();

// Trust proxy (required for correct IP rate limiting behind load balancers/proxies)
app.set("trust proxy", 1);

// Middleware
app.use(addRequestId);
app.use(helmet());
app.use(apiLimiter); // Apply rate limiting globally
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok", version: "1.0.0" });
});

// Authentication (Apply to specific routes or globally as needed)
// app.use(verifyApiKey);


// API Routes (Placeholder)
// app.use("/v1", verifyApiKey, routes);

// 404 Handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        status: false,
        message: "Endpoint not found",
    });
});

// Global Error Handler
app.use(errorHandler);

export default app;
