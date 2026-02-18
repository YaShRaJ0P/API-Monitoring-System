import { Router } from "express";
import { AlertsController } from "./alerts.controller.js";
import { AlertsService } from "./alerts.service.js";
import { AlertsRepository } from "./alerts.repository.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import { createAlertRuleSchema, updateAlertRuleSchema } from "../../shared/validation/schemas.js";

/**
 * Creates the alerts router with DI and input validation.
 * @returns {Router} Express router for /alerts endpoints
 */
const createAlertsRouter = () => {
    const router = Router();
    const repo = new AlertsRepository();
    const service = new AlertsService(repo);
    const controller = new AlertsController(service);

    router.post("/", validate(createAlertRuleSchema), controller.createRule);
    router.get("/", controller.getRules);
    router.get("/history", controller.getHistory);
    router.put("/:id", validate(updateAlertRuleSchema), controller.updateRule);
    router.delete("/:id", controller.deleteRule);

    return router;
};

export const alertsRouter = createAlertsRouter();
