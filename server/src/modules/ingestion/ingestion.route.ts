import { Router } from "express";
import { Circuit } from "../../config/circuit.js";
import { DataBaseConfig } from "../../config/db/index.js";
import { IngestionService } from "./ingestion.service.js";
import { IngestionController } from "./ingestion.controller.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import { ingestEventSchema } from "../../shared/validation/schemas.js";

/**
 * Creates the ingestion router with all dependencies wired via DI.
 * This factory function acts as a local composition root.
 * @returns {Router} Express router for /ingest endpoints
 */
export function IngestionRouter(): Router {
    const router = Router();

    // Wire dependencies
    const redis = DataBaseConfig.getRedisClient();
    const circuit = new Circuit(redis);
    const ingestionService = new IngestionService(circuit);
    const ingestionController = new IngestionController(ingestionService);

    router.post("/", validate(ingestEventSchema), ingestionController.ingestData);

    return router;
}