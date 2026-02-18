import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthRequest } from "../../shared/types/auth.types.js";
import response from "../../shared/utils/response.js";
import { TenantService } from "./tenant.service.js";


/**
 * Controller for tenant management routes.
 * Handles API key generation and tenant lookups.
 */
export class TenantController {
    constructor(private readonly tenantService: TenantService) { }

    /**
     * Creates/regenerates an API key (env_id) for the authenticated tenant.
     * @param {AuthRequest} req - Express request with authenticated user ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    createApiKey = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = (req as AuthRequest).id;
            if (!id) {
                throw new AppError(401, "Unauthorized");
            }
            const tenant = await this.tenantService.createApiKey(id);
            response(res, 200, "API key generated successfully", { env_id: tenant.env_id });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Retrieves tenant info by API key (x-api-key header).
     * @param {Request} req - Express request with x-api-key header
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    getTenant = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const envId = req.headers["x-api-key"] as string;
            if (!envId) {
                throw new AppError(400, "x-api-key header is required");
            }
            const tenant = await this.tenantService.getTenant(envId);
            response(res, 200, "OK", tenant);
        } catch (error) {
            next(error);
        }
    }
}
