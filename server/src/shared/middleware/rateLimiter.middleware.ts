import rateLimit from "express-rate-limit";
import { createLogger } from "../utils/logger.js";

const log = createLogger("RateLimiter");

/**
 * Global API rate limiter — applies to all routes.
 * Limits each IP to 100 requests per 15-minute window.
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests, please try again later.",
    },
    handler: (req, res, next, options) => {
        log.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json(options.message);
    },
});

/**
 * Strict rate limiter for auth routes (login, token refresh).
 * Limits each IP to 20 requests per 15-minute window.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts, please try again later.",
    },
});

/**
 * Strict rate limiter for ingestion endpoint.
 * Limits each IP to 500 requests per minute.
 */
export const ingestLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Ingestion rate limit exceeded.",
    },
});
