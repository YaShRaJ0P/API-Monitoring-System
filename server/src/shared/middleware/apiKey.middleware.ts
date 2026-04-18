import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { AppError } from "../errors/AppError.js";
import { createLogger } from "../utils/logger.js";
import { DataBaseConfig } from "../../config/db/index.js";
import { decryptSecret } from "../utils/crypto.js";
import type { AuthRequest } from "../types/auth.types.js";
import { config } from "../../config/config.js";

const log = createLogger("ApiKeyGuard");

// ---- Rate limit config ----
const RATE_LIMIT = config.api.rateLimit.capacity;
const WINDOW_SECONDS = 60;

export async function apiKeyGuard(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        // ---- 1. Headers ----
        const apiKey = req.headers["x-api-key"] as string;
        const signature = req.headers["x-signature"] as string;
        const timestamp = req.headers["x-timestamp"] as string;

        if (!apiKey || !signature || !timestamp) {
            throw new AppError(
                401,
                "Missing headers: x-api-key, x-signature, x-timestamp"
            );
        }

        // ---- 2. Timestamp replay protection (+/- 5 min) ----
        const requestTime = Number(timestamp);
        const now = Date.now();

        if (
            Number.isNaN(requestTime) ||
            Math.abs(now - requestTime) > 5 * 60 * 1000
        ) {
            throw new AppError(401, "Request expired or timestamp invalid");
        }

        // ---- 3. Redis ----
        const redis = DataBaseConfig.getRedisClient();
        const apiKeyCacheKey = `apikey:${apiKey}`;
        const rateLimitKey = `ratelimit:${apiKey}`;

        // ---- 4. Load API key metadata (single GET) ----
        let project: {
            id: string;
            api_secret: string;
            tenant_id: string;
        };

        const t0 = Date.now();
        const cached = await redis.get(apiKeyCacheKey);
        console.log(`redis get apikey: ${Date.now() - t0}ms`);

        if (cached) {
            project = JSON.parse(cached);
        } else {
            // ---- 5. Cache miss → Postgres ----
            const pool = DataBaseConfig.getPostgresPool();
            const result = await pool.query(
                "SELECT id, api_secret, tenant_id FROM projects WHERE api_key = $1",
                [apiKey]
            );

            if (result.rows.length === 0) {
                throw new AppError(401, "Invalid API key");
            }

            project = result.rows[0];

            // cache for 10 minutes
            await redis.setex(
                apiKeyCacheKey,
                600,
                JSON.stringify(project)
            );
        }

        // ---- 6. Rate limiting (INCR based, no Lua) ----
        const count = await redis.incr(rateLimitKey);

        if (count === 1) {
            // first hit in window
            await redis.expire(rateLimitKey, WINDOW_SECONDS);
        }

        if (count > RATE_LIMIT) {
            res.setHeader("RateLimit-Limit", RATE_LIMIT.toString());
            res.setHeader("RateLimit-Remaining", "0");
            res.setHeader("Retry-After", WINDOW_SECONDS.toString());

            return res.status(429).json({
                success: false,
                message: "Rate limit exceeded",
            });
        }

        res.setHeader("RateLimit-Limit", RATE_LIMIT.toString());
        res.setHeader(
            "RateLimit-Remaining",
            Math.max(0, RATE_LIMIT - count).toString()
        );

        // ---- 7. HMAC verification ----
        const body =
            req.body && Object.keys(req.body).length > 0
                ? JSON.stringify(req.body)
                : "";

        const payload = body + timestamp;

        let plaintextSecret: string;
        try {
            plaintextSecret = decryptSecret(project.api_secret);
        } catch {
            log.error(
                `Failed to decrypt secret for project ${project.id}`
            );
            throw new AppError(500, "Secret decryption failed");
        }

        const expectedSignature = crypto
            .createHmac("sha256", plaintextSecret)
            .update(payload)
            .digest("hex");

        if (
            expectedSignature.length !== signature.length ||
            !crypto.timingSafeEqual(
                Buffer.from(expectedSignature),
                Buffer.from(signature)
            )
        ) {
            throw new AppError(401, "Invalid signature");
        }

        // ---- 8. Attach auth context ----
        (req as AuthRequest).id = project.tenant_id;
        (req as AuthRequest).project_id = project.id;

        return next();
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }

        log.error(
            "ApiKeyGuard failed",
            undefined,
            error instanceof Error ? error : undefined
        );

        return next(new AppError(401, "Unauthorized"));
    }
}
