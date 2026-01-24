import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok", version: "1.0.0" });
});

// API Routes (Placeholder)
// app.use("/v1", routes);

// 404 Handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        status: false,
        message: "Endpoint not found",
    });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: env.NODE_ENV === "development" ? err.message : undefined,
    });
});

export default app;
