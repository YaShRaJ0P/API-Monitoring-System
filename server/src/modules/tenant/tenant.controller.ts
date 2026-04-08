import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthRequest } from "../../shared/types/auth.types.js";
import response from "../../shared/utils/response.js";
import { TenantService } from "./tenant.service.js";

export class TenantController {
    constructor(private readonly tenantService: TenantService) { }

    /**
     * Creates a new project for the authenticated tenant.
     * @param {AuthRequest} req - Express request with authenticated user ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    createProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.id;
            if (!tenantId) {
                throw new AppError(401, "Unauthorized");
            }
            const { name } = req.body;
            const project = await this.tenantService.createProject(tenantId, name);
            response(res, 201, "Project created successfully", project);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Lists all projects for the authenticated tenant.
     * @param {AuthRequest} req - Express request with authenticated user ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    listProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.id;
            if (!tenantId) {
                throw new AppError(401, "Unauthorized");
            }
            const projects = await this.tenantService.listProjects(tenantId);
            response(res, 200, "OK", projects);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Deletes a project by id for the authenticated tenant.
     * @param {AuthRequest} req - Express request with project id in params
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    deleteProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.id;
            if (!tenantId) {
                throw new AppError(401, "Unauthorized");
            }
            const id = req.params.id as string;
            await this.tenantService.deleteProject(id, tenantId);
            response(res, 200, "Project deleted successfully", null);
        } catch (error) {
            next(error);
        }
    }
}
