/**
 * Custom application error class with HTTP status code support.
 * Used throughout the application for consistent error handling.
 *
 * @param {number} statusCode - HTTP status code (e.g. 400, 404, 500)
 * @param {string} message - Human-readable error message
 * @param {unknown} details - Optional additional error context
 */
export class AppError extends Error {
    statusCode: number;
    details?: unknown;

    constructor(
        statusCode: number,
        message: string,
        details?: unknown
    ) {
        super(message);

        this.statusCode = statusCode;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}
