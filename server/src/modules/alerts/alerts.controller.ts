import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../../shared/types/auth.types.js";
import { AppError } from "../../shared/errors/AppError.js";
import { AlertsService } from "./alerts.service.js";
import response from "../../shared/utils/response.js";

/**
 * Controller for alert management routes.
 * project_id for scoping comes from:
 *   - createRule: req.body.project_id  (sent by frontend in payload)
 *   - getRules:   req.query.project_id (sent as query param)
 *   - getHistory: req.query.project_id (sent as query param)
 *   - updateRule / deleteRule: req.params.id (rule UUID), tenant scoping only
 */
export class AlertsController {
    constructor(private readonly alertsService: AlertsService) { }

    /**
     * Creates an alert rule for a project.
     * project_id is expected inside req.body (sent by the client).
     */
    createRule = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.id;
            if (!tenantId) throw new AppError(401, "Tenant ID missing");

            // project_id comes from the request body, not the URL
            const project_id = req.body.project_id as string;
            if (!project_id) throw new AppError(400, "project_id is required in body");

            const rule = await this.alertsService.createRule({
                ...req.body,
                project_id,
                tenant_id: tenantId,
            });

            response(res, 201, "Alert rule created successfully", rule);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Lists alert rules for a project.
     * project_id is expected as a query param: GET /alerts?project_id=<id>
     */
    getRules = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.id;
            if (!tenantId) throw new AppError(401, "Tenant ID missing");

            const projectId = req.query.project_id as string;

            if (!projectId) throw new AppError(400, "project_id query param is required");

            const rules = await this.alertsService.getRules(tenantId, projectId);

            response(res, 200, "Alert rules fetched successfully", rules);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Updates an alert rule.
     * Rule UUID is in req.params.id; tenant ownership is validated in the service.
     */
    updateRule = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.id;
            const { id } = req.params;
            if (!tenantId) throw new AppError(401, "Tenant ID missing");
            if (!id || typeof id !== "string") throw new AppError(400, "Rule ID missing or invalid");

            const rule = await this.alertsService.updateRule(id, tenantId, req.body);
            if (!rule) throw new AppError(404, "Rule not found");

            response(res, 200, "Alert rule updated successfully", rule);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Deletes an alert rule.
     * Rule UUID is in req.params.id; tenant ownership is validated in the service.
     */
    deleteRule = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.id;
            const { id } = req.params;
            if (!tenantId) throw new AppError(401, "Tenant ID missing");
            if (!id || typeof id !== "string") throw new AppError(400, "Rule ID missing or invalid");

            const success = await this.alertsService.deleteRule(id, tenantId);
            if (!success) throw new AppError(404, "Rule not found");

            response(res, 200, "Alert rule deleted successfully", null);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Retrieves paginated alert history for a project.
     * project_id is expected as a query param: GET /alerts/history?project_id=<id>
     */
    getHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.id;
            if (!tenantId) throw new AppError(401, "Tenant ID missing");

            const projectId = req.query.project_id as string;
            if (!projectId) throw new AppError(400, "project_id query param is required");

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            const history = await this.alertsService.getAlertHistory(tenantId, projectId, page, limit);
            response(res, 200, "Alert history fetched successfully", history);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Manually resolves an active alert incident.
     * Rule UUID is in req.params.id.
     */
    resolveRule = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.id;
            const { id } = req.params;
            if (!tenantId) throw new AppError(401, "Tenant ID missing");
            if (!id || typeof id !== "string") throw new AppError(400, "Rule ID missing or invalid");

            const success = await this.alertsService.resolveAlert(id, tenantId);
            if (!success) throw new AppError(404, "Rule not found or incident already resolved");

            response(res, 200, "Alert rule resolved successfully", null);
        } catch (error) {
            next(error);
        }
    };
}
