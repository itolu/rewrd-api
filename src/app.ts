/// <reference path="./types/express.d.ts" />
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { specs } from "./docs/swagger";
import swaggerUi from "swagger-ui-express";
import { AppError } from "./utils/AppError";
import { verifyApiKey } from "./middleware/auth";
import { httpLogger } from "./middleware/httpLogger";
import { addRequestId } from "./middleware/requestId";
import { apiLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import express, { Request, Response, NextFunction } from "express";

const app = express();

// Trust proxy (required for correct IP rate limiting behind load balancers/proxies)
app.set("trust proxy", 1);

// Documentation - Mount BEFORE any middleware to avoid header conflicts
// Temporarily disable trust proxy for Swagger
app.set("trust proxy", false);
app.use(`/${env.SWAGGER_ROUTE_SECRET}`, (req: Request, res: Response, next: NextFunction) => {
    // Strip all forwarded headers to force HTTP detection
    delete req.headers['x-forwarded-proto'];
    delete req.headers['x-forwarded-host'];
    delete req.headers['x-forwarded-for'];
    next();
}, swaggerUi.serve);
app.get(`/${env.SWAGGER_ROUTE_SECRET}`, swaggerUi.setup(specs));
// Re-enable trust proxy immediately after Swagger
app.set("trust proxy", 1);
console.log(`📄 Swagger Docs available at /${env.SWAGGER_ROUTE_SECRET}`);

app.use(addRequestId);
app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-API-Version", "v1.0.0");
    next();
});

// Re-enable trust proxy for other routes (needed for rate limiting)
app.use((req: Request, res: Response, next: NextFunction) => {
    req.app.set('trust proxy', 1);
    next();
});

// Helmet and security middleware
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginOpenerPolicy: false,
        originAgentCluster: false,
        hsts: false,
    })
);

app.use(httpLogger); // Custom detailed logger (replaces morgan)
app.use(apiLimiter); // Apply rate limiting globally
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok", version: "1.0.0" });
});



// Authentication (Apply to specific routes or globally as needed)
// app.use(verifyApiKey);


import customerRoutes from "./routes/customerRoutes";
import merchantRoutes from "./routes/merchantRoutes";

// API Routes
// Mounting Customer Routes
app.use("/v1/customers", verifyApiKey, customerRoutes);
app.use("/v1/merchant", verifyApiKey, merchantRoutes);

// 404 Handler
app.use((req: Request, res: Response, next: NextFunction) => {
    next(new AppError("Endpoint not found", 404, "route_not_found"));
});

// Global Error Handler
app.use(errorHandler);

export default app;
