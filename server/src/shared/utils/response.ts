import { type Response } from "express";

/**
 * Sends a standardised JSON response.
 * Automatically sets `success: true` for 2xx/3xx and `success: false` for 4xx/5xx.
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Human-readable response message
 * @param {any} data - Optional response payload
 * @returns {Response} Express response
 */
const response = (res: Response, statusCode: number, message: string, data?: any): Response => {
    if (statusCode >= 400) {
        return res.status(statusCode).json({
            success: false,
            message,
            data
        })
    }

    return res.status(statusCode).json({
        success: true,
        message,
        data
    })
}

export default response;