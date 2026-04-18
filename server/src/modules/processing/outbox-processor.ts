import type { Pool } from "pg";
import type { MongoProjector } from "./mongo-projector.js";
import type { IngestionType } from "../ingestion/ingestion.validator.js";
import { createLogger } from "../../shared/utils/logger.js";
import { config } from "../../config/config.js";

const log = createLogger("OutboxProcessor");

/**
 * Background processor that polls the PostgreSQL `outbox_entries` table.
 * It reads pending events and adds them into MongoDB as `RawEvent` documents.
 */
export class OutboxProcessor {
    private isRunning = false;
    private timeoutId: NodeJS.Timeout | null = null;
    private isProcessing = false;

    // Configuration
    private readonly pollIntervalMs = config.worker.outbox.pollIntervalMs || 5000;
    private readonly batchSize = config.worker.outbox.batchSize || 100;
    private readonly maxRetries = config.worker.outbox.maxRetries || 3;

    constructor(
        private readonly pool: Pool,
        private readonly mongoProjector: MongoProjector
    ) { }

    /**
     * Starts the outbox polling loop.
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        log.debug("Starting PostgreSQL OutboxProcessor...");
        this.scheduleNextQuery();
    }

    /**
     * Gracefully stops the outbox polling loop.
     */
    async stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        log.debug("Stopping PostgreSQL OutboxProcessor...");
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        // Wait for current batch to finish if processing
        while (this.isProcessing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        log.debug("PostgreSQL OutboxProcessor stopped gracefully.");
    }

    private scheduleNextQuery() {
        if (!this.isRunning) return;
        this.timeoutId = setTimeout(() => {
            this.processBatch().catch(err => {
                log.error("Outbox processing batch failed", undefined, err instanceof Error ? err : undefined);
            }).finally(() => {
                this.scheduleNextQuery();
            });
        }, this.pollIntervalMs);
    }

    private async processBatch(): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const { rows: entries } = await this.pool.query(
                `SELECT event_id, payload, attempts
             FROM outbox_entries
             WHERE status = 'pending'
             ORDER BY created_at ASC
             LIMIT $1`,
                [this.batchSize]
            );

            if (entries.length === 0) return;

            const succeeded: string[] = [];
            const failed: { id: string; error: string; attempts: number; status: string }[] = [];

            // Concurrent MongoDB projections
            const CONCURRENCY = 10;
            for (let i = 0; i < entries.length; i += CONCURRENCY) {
                const chunk = entries.slice(i, i + CONCURRENCY);
                await Promise.all(chunk.map(async entry => {
                    try {
                        await this.mongoProjector.project(entry.payload as IngestionType);
                        succeeded.push(entry.event_id);
                    } catch (error) {
                        const newAttempts = entry.attempts + 1;
                        failed.push({
                            id: entry.event_id,
                            error: error instanceof Error ? error.message : String(error),
                            attempts: newAttempts,
                            status: newAttempts >= this.maxRetries ? "failed" : "pending",
                        });
                    }
                }));
            }

            // Single query for all successes
            if (succeeded.length > 0) {
                await this.pool.query(
                    `UPDATE outbox_entries
                 SET status = 'processed', processed_at = NOW(), attempts = attempts + 1
                 WHERE event_id = ANY($1)`,
                    [succeeded]
                );
            }

            // Single query for all failures
            if (failed.length > 0) {
                await this.pool.query(
                    `UPDATE outbox_entries AS o
                 SET status = v.status,
                     last_error = v.error,
                     attempts = v.attempts::int
                 FROM (
                     SELECT 
                         UNNEST($1::uuid[]) AS event_id,
                         UNNEST($2::text[]) AS status,
                         UNNEST($3::text[]) AS error,
                         UNNEST($4::int[])  AS attempts
                 ) AS v
                 WHERE o.event_id = v.event_id`,
                    [
                        failed.map(f => f.id),
                        failed.map(f => f.status),
                        failed.map(f => f.error),
                        failed.map(f => f.attempts),
                    ]
                );
            }

        } finally {
            this.isProcessing = false;
        }
    }

}
