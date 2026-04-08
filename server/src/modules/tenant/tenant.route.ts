import { Router } from "express";
import { TenantController } from "./tenant.controller.js";
import { TenantService } from "./tenant.service.js";
import { TenantRepository } from "./tenant.repository.js";
import type { Pool } from "pg";

/**
 * Creates tenant/project routes with DI.
 * @param {{ postgresPool: Pool }} deps - Dependencies
 * @returns {Router} Express router
 */
export function TenantRoutes({ postgresPool }: { postgresPool: Pool }): Router {
    const router = Router();

    const tenantRepo = new TenantRepository(postgresPool);
    const tenantService = new TenantService(tenantRepo);
    const tenantController = new TenantController(tenantService);

    router.post("/", tenantController.createProject);
    router.get("/", tenantController.listProjects);
    router.delete("/:id", tenantController.deleteProject);

    return router;
}
