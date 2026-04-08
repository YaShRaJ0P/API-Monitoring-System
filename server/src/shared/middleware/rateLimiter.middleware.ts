import rateLimit from "express-rate-limit";
import { createLogger } from "../utils/logger.js";

const log = createLogger("IpRateLimiter");

/**
 * Global API rate limiter - applied to every route.
 * Limits each IP to 1 000 requests per 15-minute rolling window.
 * Generous enough to not interfere with the admin dashboard's auto-polling.
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests from this IP, please try again later.",
    },
    handler: (req, res, _next, options) => {
        log.warn(`Global rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json(options.message);
    },
    skip: (req) => {
        if (req.path === "/health") return true;
        if (req.path.includes("/ingest")) return true;
        if (req.path.includes("/auth")) return true;
        return false;
    },
});

/**
 * Strict limiter for authentication routes
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts, please try again later.",
    },
});
