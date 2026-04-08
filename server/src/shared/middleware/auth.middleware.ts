import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../types/auth.types.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { AppError } from "../errors/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Protects routes by validating the Bearer access token.
 * Extracts tenant ID from the decoded JWT and attaches it to `req.id`.
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new AppError(401, "Access token is missing or malformed");
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            throw new AppError(401, "Access token is missing");
        }

        const decoded = verifyAccessToken(token) as { id: string; email: string };

        if (!decoded || !decoded.id) {
            throw new AppError(401, "Invalid access token");
        }

        (req as AuthRequest).id = decoded.id;
        (req as AuthRequest).user = {
            id: decoded.id,
            email: decoded.email,
            tenant_id: decoded.id
        };
        next();
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        next(new AppError(401, "Invalid or expired access token"));
    }
}
