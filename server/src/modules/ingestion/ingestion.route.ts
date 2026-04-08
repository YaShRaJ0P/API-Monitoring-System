import { Router } from "express";
import { Circuit, CircuitRegistry } from "../../config/circuit.js";
import { DataBaseConfig } from "../../config/db/index.js";
import { IngestionService } from "./ingestion.service.js";
import { IngestionController } from "./ingestion.controller.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import { ingestEventSchema } from "../../shared/validation/schemas.js";


export function IngestionRouter(): Router {
    const router = Router();
    const redis = DataBaseConfig.getRedisClient();
    const circuit = new Circuit(redis);
    CircuitRegistry.register(circuit);
    const ingestionService = new IngestionService(circuit);
    const ingestionController = new IngestionController(ingestionService);

    router.post("/", validate(ingestEventSchema), ingestionController.ingestData);

    return router;
}