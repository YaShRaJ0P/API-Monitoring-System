import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../types/auth.types.js";
import { AppError } from "../errors/AppError.js";
import { createLogger } from "../utils/logger.js";
import { DataBaseConfig } from "../../config/db/index.js";

const log = createLogger("ApiKeyMiddleware");

import crypto from "crypto";
import { decryptSecret } from "../utils/crypto.js";

/**
 * Protects routes by validating the x-api-key header and HMAC signature.
 * Resolves the API key to a project and tenant.
 * Attaches both project_id and tenant_id to the request.
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
    try {

        const apiKey = req.headers["x-api-key"] as string;
        const signature = req.headers["x-signature"] as string;
        const timestamp = req.headers["x-timestamp"] as string;

        if (!apiKey || !signature || !timestamp) {
            throw new AppError(401, "Missing authentications headers. x-api-key, x-signature, x-timestamp required.");
        }

        // Check timestamp drift to prevent replay attacks (+/- 5 mins)
        const requestTime = parseInt(timestamp, 10);
        const currentTime = Date.now();

        if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > 5 * 60 * 1000) {
            throw new AppError(401, "Request expired or timestamp invalid");
        }

        const pool = DataBaseConfig.getPostgresPool();
        const result = await pool.query(
            "SELECT id, api_secret, tenant_id FROM projects WHERE api_key = $1",
            [apiKey]
        );

        if (result.rows.length === 0) {
            throw new AppError(401, "Invalid API key");
        }

        const project = result.rows[0];

        // Compute HMAC signature
        const bodyContent = Object.keys(req.body || {}).length > 0 ? JSON.stringify(req.body) : "";
        const payloadToSign = bodyContent + timestamp;

        // Decrypt the stored AES ciphertext to recover the plaintext secret
        // This keeps HMAC verification intact while the DB stores only encrypted data
        let plaintextSecret: string;
        try {
            plaintextSecret = decryptSecret(project.api_secret);
        } catch {
            log.error(`Failed to decrypt api_secret for project ${project.id} - ENCRYPTION_KEY may have changed`);
            throw new AppError(500, "Internal error: secret decryption failed");
        }

        const expectedSignature = crypto
            .createHmac("sha256", plaintextSecret)
            .update(payloadToSign)
            .digest("hex");

        // Use timingSafeEqual to prevent timing attacks
        if (
            expectedSignature.length !== signature.length ||
            !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
        ) {
            throw new AppError(401, "Invalid signature");
        }

        const tenantId = project.tenant_id as string;
        const projectId = project.id as string;

        (req as AuthRequest).id = tenantId;
        (req as AuthRequest).project_id = projectId;

        next();
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        log.error("API key validation failed", undefined, error instanceof Error ? error : undefined);
        next(new AppError(401, "Invalid API key"));
    }
}
