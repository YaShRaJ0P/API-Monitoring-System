import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Global error-handling middleware.
 * Catches AppError instances and unhandled exceptions,
 * logs them appropriately, and returns a structured JSON response.
 * @param {unknown} err - The thrown error
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function (required by Express signature)
 */
export function errorMiddleware(
    err: unknown,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
            status: err.status,
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
