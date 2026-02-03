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

// Middleware
app.use(addRequestId);
app.use(helmet());
app.use(httpLogger); // Custom detailed logger (replaces morgan)
app.use(apiLimiter); // Apply rate limiting globally
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok", version: "1.0.0" });
});

// Documentation (Development Only)
if (env.NODE_ENV === "development") {
    app.use(`/${env.SWAGGER_ROUTE_SECRET}`, swaggerUi.serve, swaggerUi.setup(specs));
    console.log(`📄 Swagger Docs available at http://localhost:${env.PORT}/${env.SWAGGER_ROUTE_SECRET}`);
}

// Authentication (Apply to specific routes or globally as needed)
// app.use(verifyApiKey);


import customerRoutes from "./routes/customerRoutes";

// API Routes
// Mounting Customer Routes
app.use("/v1/customers", verifyApiKey, customerRoutes);

// 404 Handler
app.use((req: Request, res: Response, next: NextFunction) => {
    next(new AppError("Endpoint not found", 404, "route_not_found"));
});

// Global Error Handler
app.use(errorHandler);

export default app;
