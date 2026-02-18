import { Router } from "express";
import type { Pool } from "pg";
import { MetricsRepository } from "./metrics.repository.js";
import { MetricsService } from "./metrics.service.js";
import { MetricsController } from "./metrics.controller.js";

/**
 * Creates the metrics router with all dependencies wired via DI.
 * Acts as a local composition root for the metrics module.
 * @param {{ postgresPool: Pool }} deps - Injected dependencies
 * @returns {Router} Express router for /metrics endpoints
 */
export function MetricsRoutes({ postgresPool }: { postgresPool: Pool }): Router {
    const router = Router();

    // Wire dependencies
    const metricsRepo = new MetricsRepository(postgresPool);
    const metricsService = new MetricsService(metricsRepo);
    const metricsController = new MetricsController(metricsService);

    router.get("/overview", metricsController.getOverview);
    router.get("/timeseries", metricsController.getTimeseries);
    router.get("/endpoints", metricsController.getEndpoints);
    router.get("/services", metricsController.getServices);
    router.get("/logs", metricsController.getLogs);

    return router;
}
