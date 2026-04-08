import { Router } from "express";
import type { Pool } from "pg";
import { DLQRepository } from "./dlq.repository.js";
import { DLQService } from "./dlq.service.js";
import { DLQController } from "./dlq.controller.js";

/**
 * DLQ (Dead Letter Queue) API for monitoring and replaying failed outbox entries.
 * Failed entries are automatically marked by the OutboxProcessor in PostgreSQL 
 * when an entry exceeds max retries.
 */
export function DLQRoutes({ postgresPool }: { postgresPool: Pool }): Router {
    const router = Router();

    const repo = new DLQRepository(postgresPool);
    const service = new DLQService(repo);
    const controller = new DLQController(service);

    router.get("/", controller.getFailedEntries);
    router.get("/stats", controller.getStats);
    router.post("/replay/:id", controller.replayEntry);
    router.post("/replay-all", controller.replayAll);

    return router;
}
