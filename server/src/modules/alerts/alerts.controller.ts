import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../shared/types/auth.types.js";
import { AppError } from "../../shared/errors/AppError.js";
import { AlertsService } from "./alerts.service.js";

export class AlertsController {
    constructor(private readonly alertsService: AlertsService) { }

    createRule = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).user?.tenant_id;
            if (!tenantId) throw new AppError(401, "Tenant ID missing");

            const rule = await this.alertsService.createRule({
                ...req.body,
                tenant_id: tenantId
            });

            res.status(201).json({ success: true, data: rule });
        } catch (error) {
            next(error);
        }
    };

    getRules = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).user?.tenant_id;
            if (!tenantId) throw new AppError(401, "Tenant ID missing");

            const rules = await this.alertsService.getRules(tenantId);
            res.json({ success: true, data: rules });
        } catch (error) {
            next(error);
        }
    };

    updateRule = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).user?.tenant_id;
            const { id } = req.params;
            if (!tenantId) throw new AppError(401, "Tenant ID missing");
            if (!id || typeof id !== 'string') throw new AppError(400, "Rule ID missing or invalid");

            const rule = await this.alertsService.updateRule(id, tenantId, req.body);
            if (!rule) throw new AppError(404, "Rule not found");

            res.json({ success: true, data: rule });
        } catch (error) {
            next(error);
        }
    };

    deleteRule = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).user?.tenant_id;
            const { id } = req.params;
            if (!tenantId) throw new AppError(401, "Tenant ID missing");
            if (!id || typeof id !== 'string') throw new AppError(400, "Rule ID missing or invalid");

            const success = await this.alertsService.deleteRule(id, tenantId);
            if (!success) throw new AppError(404, "Rule not found");

            res.json({ success: true, message: "Rule deleted" });
        } catch (error) {
            next(error);
        }
    };

    /**
     * Retrieves paginated alert history for the authenticated tenant.
     */
    getHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = (req as AuthRequest).user?.tenant_id;
            if (!tenantId) throw new AppError(401, "Tenant ID missing");

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            const history = await this.alertsService.getAlertHistory(tenantId, page, limit);
            res.json({ success: true, data: history.data, total: history.total });
        } catch (error) {
            next(error);
        }
    };
}
