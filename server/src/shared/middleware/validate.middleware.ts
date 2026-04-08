import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";

/**
 * Express middleware factory for validating request bodies against a Zod schema.
 * Returns 400 with field-level errors if validation fails.
 * @param {ZodSchema} schema - Zod schema to validate against
 * @returns {RequestHandler} Express middleware
 */
export function validate(schema: ZodSchema): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors = error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                }));

                res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors,
                });
                return;
            }
            next(error);
        }
    };
}
