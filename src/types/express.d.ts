import { Request } from "express";

declare global {
    namespace Express {
        interface Request {
            merchant?: {
                id: string; // The merchant_id (string based on schema)
                // Add other merchant properties as needed
            };
            user?: {
                id: string; // uid
            }
        }
    }
}
