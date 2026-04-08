import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../shared/types/auth.types.js";
import type { MetricsService } from "./metrics.service.js";
import { validateMetricsQuery } from "./metrics.validator.js";
import { AppError } from "../../shared/errors/AppError.js";
import response from "../../shared/utils/response.js";

/**
 * Controller for metrics read endpoints.
 * All handlers require authentication and a project_id query param.
 */
export class MetricsController {
    constructor(private readonly metricsService: MetricsService) { }

    /**
     * Returns dashboard overview stats.
     * Requires project_id query param.
     * @param {AuthRequest} req - Express request
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    getOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.id;
            if (!tenantId) throw new AppError(401, "Unauthorized");

            const projectId = req.query.project_id as string;
            if (!projectId) throw new AppError(400, "Select the project first");

            const parsed = validateMetricsQuery(req.query);
            if (!parsed.success) {
                return response(res, 400, "Invalid query parameters", parsed.error);
            }

            const data = await this.metricsService.getOverview(tenantId, projectId, parsed.data);
            response(res, 200, "OK", data);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Returns time-bucketed request counts and latency for charting.
     * Requires project_id query param.
     */
    getTimeseries = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).id;
            if (!tenantId) throw new AppError(401, "Unauthorized");

            const projectId = req.query.project_id as string;
            if (!projectId) throw new AppError(400, "project_id query param is required");

            const parsed = validateMetricsQuery(req.query);
            if (!parsed.success) {
                return response(res, 400, "Invalid query parameters", parsed.error);
            }

            const data = await this.metricsService.getTimeseries(tenantId, projectId, parsed.data);
            response(res, 200, "OK", data);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Returns per-endpoint performance breakdown.
     * Requires project_id query param.
     */
    getEndpoints = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).id;
            if (!tenantId) throw new AppError(401, "Unauthorized");

            const projectId = req.query.project_id as string;
            if (!projectId) throw new AppError(400, "project_id query param is required");

            const parsed = validateMetricsQuery(req.query);
            if (!parsed.success) {
                return response(res, 400, "Invalid query parameters", parsed.error);
            }

            const data = await this.metricsService.getEndpointStats(tenantId, projectId, parsed.data);
            response(res, 200, "OK", data);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Returns per-service summary.
     * Requires project_id query param.
     */
    getServices = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).id;
            if (!tenantId) throw new AppError(401, "Unauthorized");

            const projectId = req.query.project_id as string;
            if (!projectId) throw new AppError(400, "project_id query param is required");

            const parsed = validateMetricsQuery(req.query);
            if (!parsed.success) {
                return response(res, 400, "Invalid query parameters", parsed.error);
            }

            const data = await this.metricsService.getServiceStats(tenantId, projectId, parsed.data);
            response(res, 200, "OK", data);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Returns paginated raw event logs.
     * Requires project_id query param.
     */
    getLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).id;
            if (!tenantId) throw new AppError(401, "Unauthorized");

            const projectId = req.query.project_id as string;
            if (!projectId) throw new AppError(400, "project_id query param is required");

            const parsed = validateMetricsQuery(req.query);
            if (!parsed.success) {
                return response(res, 400, "Invalid query parameters", parsed.error);
            }

            const data = await this.metricsService.getLogs(tenantId, projectId, parsed.data);
            response(res, 200, "OK", data);
        } catch (error) {
            next(error);
        }
    };
}
