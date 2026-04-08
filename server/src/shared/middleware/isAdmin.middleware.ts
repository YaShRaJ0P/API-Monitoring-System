import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../types/auth.types.js";
import { PostgreSQL } from "../../config/db/postgres.js";
import { AppError } from "../errors/AppError.js";

/**
 * Admin Only Middleware
 *
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export async function isAdminMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const tenantId = (req as AuthRequest).id;
        if (!tenantId) {
            throw new AppError(401, "Unauthorized");
        }

        const pool = PostgreSQL.getPool();
        const result = await pool.query(
            "SELECT is_admin FROM tenants WHERE id = $1",
            [tenantId],
        );

        if (!result.rows[0]?.is_admin) {
            throw new AppError(403, "Admin access required");
        }

        next();
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        next(new AppError(403, "Forbidden"));
    }
}
