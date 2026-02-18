import type { Request } from "express";

export interface AuthRequest extends Request {
    id?: string;
    user?: {
        tenant_id: string;
        email: string;
        id: string;
    };
}
