import { Router } from "express";
import { AdminRepository } from "./admin.repository.js";
import { AdminService } from "./admin.service.js";
import { AdminController } from "./admin.controller.js";

/**
 * Admin-only routes for user management.
 * All routes require authMiddleware + isAdminMiddleware applied in app.ts.
 * @returns {Router}
 */
export function AdminRoutes(): Router {
    const router = Router();

    const repo = new AdminRepository();
    const service = new AdminService(repo);
    const controller = new AdminController(service);

    router.get("/users", controller.getUsers);
    router.delete("/users/:id", controller.deleteUser);
    router.patch("/users/:id/toggle-admin", controller.toggleAdmin);
    router.get("/users/system-stats", controller.getSystemStats);

    router.post("/rabbitmq/down", controller.rabbitMqDown);
    router.post("/rabbitmq/up", controller.rabbitMqUp);
    router.get("/rabbitmq/status", controller.rabbitMqStatus);
    router.get("/circuit/stats", controller.getCircuitStats);

    return router;
}
