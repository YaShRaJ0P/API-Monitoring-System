import { Router } from "express";
import { TenantController } from "./tenant.controller.js";
import { TenantService } from "./tenant.service.js";
import { TenantRepository } from "./tenant.repository.js";
import type { Pool } from "pg";

export function TenantRoutes({ postgresPool }: { postgresPool: Pool }) {
    const router = Router();

    const tenantRepo = new TenantRepository(postgresPool);
    const tenantService = new TenantService(tenantRepo);
    const tenantController = new TenantController(tenantService);

    router.post("/api-key", tenantController.createApiKey);
    router.get("/", tenantController.getTenant);

    return router;
}
