import type { NextFunction, Response } from "express";
import { DataBaseConfig } from "../../config/db/index.js";
import type { AuthRequest } from "../types/auth.types.js";
import { AppError } from "../errors/AppError.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("RateLimiter");

// ── Rate limit config ──
const CAPACITY = 100; // Bucket size (burst capacity)
const REFILL_RATE = 10; // Tokens per second
const REQUEST_COST = 1;

/**
 * Lua script for Token Bucket algorithm.
 * Atomically checks and updates token bucket.
 * KEYS[1]: tokens_key
 * KEYS[2]: timestamp_key
 * ARGV[1]: refill_rate (tokens/sec)
 * ARGV[2]: capacity (max tokens)
 * ARGV[3]: now (unix timestamp in ms)
 * ARGV[4]: requested (tokens needed)
 */
const TOKEN_BUCKET_SCRIPT = `
    local tokens_key = KEYS[1]
    local timestamp_key = KEYS[2]
    local rate = tonumber(ARGV[1])
    local capacity = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local requested = tonumber(ARGV[4])

    local last_refill = tonumber(redis.call("get", timestamp_key))
    local tokens = tonumber(redis.call("get", tokens_key))

    -- Initialize if missing
    if not last_refill then
        last_refill = now
        tokens = capacity
    end

    -- Calculate refill
    local delta = math.max(0, (now - last_refill) / 1000)
    local filled_tokens = math.min(capacity, tokens + (rate * delta))

    if filled_tokens >= requested then
        local new_tokens = filled_tokens - requested
        redis.call("set", tokens_key, new_tokens)
        redis.call("set", timestamp_key, now)
        
        -- Set expiry to keep keys clean (e.g., 1 hour idle)
        redis.call("expire", tokens_key, 3600)
        redis.call("expire", timestamp_key, 3600)
        
        return {1, new_tokens} -- Allowed, remaining
    else
        return {0, filled_tokens} -- Denied, current
    end
`;

/**
 * Redis-backed Token Bucket rate limiter.
 * Provides smooth traffic shaping with burst capacity.
 *
 * @param {AuthRequest} req - Express request with x-api-key header
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export async function rateLimitMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const redisClient = DataBaseConfig.getRedisClient();

        const apiKey = req.headers["x-api-key"] as string;
        if (!apiKey) {
            // Skip rate limiting if no API key (auth middleware handles 401 later if needed)
            // or enforce strictly depending on requirements.
            // For now, consistent with previous behavior:
            return next(new AppError(400, "API key not provided"));
        }

        const tokensKey = `ratelimit:${apiKey}:tokens`;
        const timestampKey = `ratelimit:${apiKey}:ts`;
        const now = Date.now();

        // Check bucket
        const result = await redisClient.eval(TOKEN_BUCKET_SCRIPT, {
            keys: [tokensKey, timestampKey],
            arguments: [
                REFILL_RATE.toString(),
                CAPACITY.toString(),
                now.toString(),
                REQUEST_COST.toString(),
            ],
        }) as [number, number];

        const [allowed, remaining] = result;

        if (allowed === 1) {
            res.setHeader("X-RateLimit-Remaining", Math.floor(remaining));
            next();
        } else {
            log.warn(`Rate limit exceeded for API key: ${apiKey.substring(0, 8)}...`);
            res.setHeader("X-RateLimit-Remaining", 0);
            res.setHeader("Retry-After", 1); // Suggest retry in 1s
            res.status(429).json({
                success: false,
                message: "Too many requests, please try again later",
            });
        }
    } catch (error) {
        log.error("Rate limiter processing error", undefined, error instanceof Error ? error : undefined);
        // Fail open if Redis is down
        next();
    }
}
