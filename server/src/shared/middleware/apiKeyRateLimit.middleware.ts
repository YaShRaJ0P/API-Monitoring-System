import type { NextFunction, Response } from "express";
import { DataBaseConfig } from "../../config/db/index.js";
import type { AuthRequest } from "../types/auth.types.js";
import { AppError } from "../errors/AppError.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("ApiKeyRateLimiter");

const CAPACITY = 500; // max burst
const REFILL_RATE = 50;  // tokens / second  (3000 / min sustained)
const REQUEST_COST = 1;


const TOKEN_BUCKET_SCRIPT = `
    local tokens_key     = KEYS[1]
    local timestamp_key  = KEYS[2]
    local rate           = tonumber(ARGV[1])
    local capacity       = tonumber(ARGV[2])
    local now            = tonumber(ARGV[3])
    local requested      = tonumber(ARGV[4])

    local last_refill = tonumber(redis.call("get", timestamp_key))
    local tokens      = tonumber(redis.call("get", tokens_key))

    -- First request for this key - initialise to full bucket
    if not last_refill then
        last_refill = now
        tokens      = capacity
    end

    -- Refill proportional to elapsed time
    local delta        = math.max(0, (now - last_refill) / 1000)
    local filled       = math.min(capacity, tokens + (rate * delta))

    local reset_secs

    if filled >= requested then
        local new_tokens = filled - requested
        redis.call("set",    tokens_key,    new_tokens)
        redis.call("set",    timestamp_key, now)
        redis.call("expire", tokens_key,    3600)
        redis.call("expire", timestamp_key, 3600)
        -- Seconds until bucket is completely full again
        reset_secs = math.ceil((capacity - new_tokens) / rate)
        return {1, math.floor(new_tokens), reset_secs}
    else
        -- Seconds until there are enough tokens to allow the next request
        reset_secs = math.ceil((requested - filled) / rate)
        return {0, math.floor(filled), reset_secs}
    end
`;

/**
 * Redis-backed Token Bucket rate limiter keyed by API key.
 *
 *
 * @param {AuthRequest} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export async function apiKeyLimiter(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const apiKey = req.headers["x-api-key"] as string;
        if (!apiKey) {
            return next(new AppError(400, "API key not provided"));
        }

        const redisClient = DataBaseConfig.getRedisClient();
        const tokensKey = `ratelimit:${apiKey}:tokens`;
        const timestampKey = `ratelimit:${apiKey}:ts`;
        const now = Date.now();

        const result = await redisClient.eval(TOKEN_BUCKET_SCRIPT, {
            keys: [tokensKey, timestampKey],
            arguments: [
                REFILL_RATE.toString(),
                CAPACITY.toString(),
                now.toString(),
                REQUEST_COST.toString(),
            ],
        }) as [number, number, number];

        const [allowed, remaining, resetSecs] = result;

        // IETF RateLimit draft-6 headers
        res.setHeader("RateLimit-Limit", CAPACITY);
        res.setHeader("RateLimit-Remaining", remaining);
        res.setHeader("RateLimit-Reset", resetSecs);

        if (allowed === 1) {
            return next();
        }

        log.warn(`Ingest rate limit exceeded - API key: ${apiKey.substring(0, 8)}…`);
        res.setHeader("Retry-After", resetSecs);
        return res.status(429).json({
            success: false,
            message: "Ingestion rate limit exceeded. Slow down and retry shortly.",
            retryAfterSeconds: resetSecs,
        });

    } catch (error) {
        // Fail-open: do not block traffic if Redis is temporarily unavailable.
        log.error("ApiKeyLimiter error - failing open", undefined, error instanceof Error ? error : undefined);
        return next();
    }
}
