import { AppError } from "../utils/AppError";
import { AnyZodObject, ZodError } from "zod";
import { Request, Response, NextFunction } from "express";

export const validateRequest = (schema: AnyZodObject) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        req.body = parsed.body;
        req.query = parsed.query;
        req.params = parsed.params;

        next();
    } catch (error) {
        if (error instanceof ZodError) {
            const validationErrors = error.errors.map((err) => ({
                code: "validation_error",
                field: err.path.join("."),
                message: err.message,
            }));

            // For now, just take the first error message to be concise, or we could pass the array
            // But AppError expects a single string message. So, we send the validation errors one after the other
            const firstError = validationErrors[0];
            next(new AppError(`Validation Error: ${firstError.field} - ${firstError.message}`, 400, "validation_error"));
        } else {
            next(error);
        }
    }
};
