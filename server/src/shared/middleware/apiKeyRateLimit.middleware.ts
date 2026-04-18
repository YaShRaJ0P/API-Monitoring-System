import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../types/auth.types.js";
import { DataBaseConfig } from "../../config/db/index.js";
import { AppError } from "../errors/AppError.js";
import { createLogger } from "../utils/logger.js";
import { config } from "../../config/config.js";
import type Redis from "ioredis";

const log = createLogger("ApiKeyRateLimiter");

// ---- Config ----
const CAPACITY = config.api.rateLimit.capacity;
const REFILL_RATE = config.api.rateLimit.refillRate;

const CAPACITY_STR = CAPACITY.toString();
const REFILL_RATE_STR = REFILL_RATE.toString();
const REQUEST_COST_STR = "1";

const SCRIPT_TTL_SECONDS = 7200;

// ---- Lua script ----
const API_KEY_AND_RATE_LIMIT_SCRIPT = `
local api_key_cache = KEYS[1]
local tokens_key    = KEYS[2]
local timestamp_key = KEYS[3]

local rate      = tonumber(ARGV[1])
local capacity  = tonumber(ARGV[2])
local now       = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttl       = tonumber(ARGV[5])

-- ===== 1. API KEY VALIDATION =====
local apiKeyExists = redis.call("get", api_key_cache)

if not apiKeyExists then
    return {0, 0, 0}
end

-- ===== 2. LOAD STATE =====
local last_refill = tonumber(redis.call("get", timestamp_key))
local tokens      = tonumber(redis.call("get", tokens_key))

if not last_refill then
    last_refill = now
    tokens = capacity
end

-- ===== 3. REFILL =====
local delta = math.max(0, (now - last_refill) / 1000)

-- guard against NaN
if not tokens then tokens = capacity end

local filled = tokens + (rate * delta)

if filled > capacity then
    filled = capacity
end

-- ===== 4. DECISION =====
local reset_secs

if filled >= requested then
    local new_tokens = filled - requested

    redis.call("setex", tokens_key, ttl, new_tokens)
    redis.call("setex", timestamp_key, ttl, now)

    reset_secs = math.ceil((capacity - new_tokens) / rate)

    return {1, math.floor(new_tokens), reset_secs} -- allowed
else
    reset_secs = math.ceil((requested - filled) / rate)
    return {2, math.floor(filled), reset_secs} -- rate limited
end
`;


// ---- Extend ioredis type ----
type RedisWithCommands = Redis & {
    apiKeyGuard: (
        apiKeyCache: string,
        tokensKey: string,
        timestampKey: string,
        rate: string,
        capacity: string,
        now: string,
        cost: string,
        ttl: string
    ) => Promise<unknown>;
};

let isCommandDefined = false;

function ensureCommand(redis: RedisWithCommands) {
    if (isCommandDefined) return;

    redis.defineCommand("apiKeyGuard", {
        numberOfKeys: 3,
        lua: API_KEY_AND_RATE_LIMIT_SCRIPT,
    });

    isCommandDefined = true;
}

// ---- Middleware ----
export async function apiKeyLimiter(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const apiKey = req.headers["x-api-key"];

        if (typeof apiKey !== "string" || apiKey.length === 0) {
            return next(new AppError(400, "API key not provided"));
        }


        const redisClient = DataBaseConfig.getRedisClient() as RedisWithCommands;
        ensureCommand(redisClient);

        const cacheKey = `apikey:${apiKey}`;
        const tokensKey = `ratelimit:${apiKey}:tokens`;
        const timestampKey = `ratelimit:${apiKey}:ts`;

        const now = Date.now().toString();

        const rawResult = await redisClient.apiKeyGuard(
            cacheKey,
            tokensKey,
            timestampKey,
            REFILL_RATE_STR,
            CAPACITY_STR,
            now,
            REQUEST_COST_STR,
            SCRIPT_TTL_SECONDS.toString()
        );

        if (!Array.isArray(rawResult) || rawResult.length !== 3) {
            throw new Error("Invalid Redis response");
        }

        const [codeRaw, remainingRaw, resetRaw] = rawResult;

        const code = Number(codeRaw);
        const remaining = Number(remainingRaw);
        const reset = Number(resetRaw);

        // ---- INVALID API KEY ----
        if (code === 0) {
            return next(new AppError(401, "Invalid API key"));
        }

        // ---- HEADERS ----
        const remainingSafe = Math.max(0, Math.floor(remaining));
        const resetSafe = Math.max(0, Math.ceil(reset));

        res.setHeader("RateLimit-Limit", CAPACITY);
        res.setHeader("RateLimit-Remaining", remainingSafe.toString());
        res.setHeader("RateLimit-Reset", resetSafe.toString());

        // ---- RATE LIMITED ----
        if (code === 2) {
            res.setHeader("Retry-After", resetSafe.toString());

            log.warn(`Rate limit exceeded - API key: ${apiKey.slice(0, 8)}…`);

            return res.status(429).json({
                success: false,
                message: "Rate limit exceeded. Try again shortly.",
                retryAfterSeconds: resetSafe,
            });
        }

        return next();

    } catch (error) {
        log.error(
            "ApiKeyGuard error - failing open",
            undefined,
            error instanceof Error ? error : undefined
        );

        return next();
    }
}