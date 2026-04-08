import type { Request } from "express";

/**
 * Extended Express Request with authentication context.
 */
export interface AuthRequest extends Request {
    id?: string;          // tenant_id (set by both auth middlewares)
    project_id?: string;  // project id (set by apiKey middleware for SDK requests)
}
