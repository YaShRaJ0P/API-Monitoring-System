import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../shared/types/auth.types.js";
import type { MetricsService } from "./metrics.service.js";
import { validateMetricsQuery } from "./metrics.validator.js";
import { AppError } from "../../shared/errors/AppError.js";
import response from "../../shared/utils/response.js";

/**
 * Controller for metrics read endpoints.
 * All handlers require authentication and scope queries to the tenant.
 */
export class MetricsController {
    constructor(private readonly metricsService: MetricsService) { }

    /**
     * Returns dashboard overview stats (total requests, avg latency, error rate, p95/p99).
     * @param {AuthRequest} req - Express request with authenticated tenant ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    getOverview = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).id;
            if (!tenantId) throw new AppError(401, "Unauthorized");

            const parsed = validateMetricsQuery(req.query);
            if (!parsed.success) {
                return response(res, 400, "Invalid query parameters", parsed.error);
            }

            const data = await this.metricsService.getOverview(tenantId, parsed.data);
            response(res, 200, "OK", data);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Returns time-bucketed request counts and latency for charting.
     * @param {AuthRequest} req - Express request with authenticated tenant ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    getTimeseries = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).id;
            if (!tenantId) throw new AppError(401, "Unauthorized");

            const parsed = validateMetricsQuery(req.query);
            if (!parsed.success) {
                return response(res, 400, "Invalid query parameters", parsed.error);
            }

            const data = await this.metricsService.getTimeseries(tenantId, parsed.data);
            response(res, 200, "OK", data);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Returns per-endpoint performance breakdown.
     * @param {AuthRequest} req - Express request with authenticated tenant ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    getEndpoints = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).id;
            if (!tenantId) throw new AppError(401, "Unauthorized");

            const parsed = validateMetricsQuery(req.query);
            if (!parsed.success) {
                return response(res, 400, "Invalid query parameters", parsed.error);
            }

            const data = await this.metricsService.getEndpointStats(tenantId, parsed.data);
            response(res, 200, "OK", data);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Returns per-service summary.
     * @param {AuthRequest} req - Express request with authenticated tenant ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    getServices = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).id;
            if (!tenantId) throw new AppError(401, "Unauthorized");

            const parsed = validateMetricsQuery(req.query);
            if (!parsed.success) {
                return response(res, 400, "Invalid query parameters", parsed.error);
            }

            const data = await this.metricsService.getServiceStats(tenantId, parsed.data);
            response(res, 200, "OK", data);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Returns paginated raw event logs.
     * @param {AuthRequest} req - Express request with authenticated tenant ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    getLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).id;
            if (!tenantId) throw new AppError(401, "Unauthorized");

            const parsed = validateMetricsQuery(req.query);
            if (!parsed.success) {
                return response(res, 400, "Invalid query parameters", parsed.error);
            }

            const data = await this.metricsService.getLogs(tenantId, parsed.data);
            response(res, 200, "OK", data);
        } catch (error) {
            next(error);
        }
    };
}
