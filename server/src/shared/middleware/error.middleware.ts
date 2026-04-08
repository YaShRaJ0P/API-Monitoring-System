import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Global error-handling middleware.
 * @param {unknown} err - The thrown error
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export function errorMiddleware(
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
) {
    if (err instanceof AppError) {
        // Only log 5xx errors as actual errors, others as warnings/info if needed
        if (err.statusCode >= 500) {
            logger.error(`AppError [${err.statusCode}]: ${err.message}`, { path: req.path, method: req.method }, err);
        } else {
            logger.warn(`Client Error [${err.statusCode}]: ${err.message}`, { path: req.path, method: req.method });
        }

        return res.status(err.statusCode).json({
            status: err.statusCode,
            message: err.message,
            details: err.details ?? null
        });
    }

    // Unhandled errors
    logger.error("Unhandled exception", { path: req.path, method: req.method }, err instanceof Error ? err : undefined);

    return res.status(500).json({
        status: "error",
        message: "Internal Server Error"
    });
}
