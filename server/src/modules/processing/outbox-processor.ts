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
        log.info("Starting PostgreSQL OutboxProcessor...");
        this.scheduleNextQuery();
    }

    /**
     * Gracefully stops the outbox polling loop.
     */
    async stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        log.info("Stopping PostgreSQL OutboxProcessor...");
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        // Wait for current batch to finish if processing
        while (this.isProcessing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        log.info("PostgreSQL OutboxProcessor stopped gracefully.");
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
            // 1. Fetch pending entries, order by creation, limit to batchSize
            const { rows: entries } = await this.pool.query(
                `SELECT event_id, payload, attempts
                 FROM outbox_entries
                 WHERE status = 'pending'
                 ORDER BY created_at ASC
                 LIMIT $1`,
                [this.batchSize]
            );

            if (entries.length === 0) {
                return; // Nothing to process
            }
            // 2. Process each entry
            for (const entry of entries) {
                await this.processEntry(entry);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    private async processEntry(entry: any): Promise<void> {
        const { event_id, payload, attempts } = entry;
        const newAttempts = attempts + 1;

        try {
            const ingestionData = payload as IngestionType;
            await this.mongoProjector.project(ingestionData);

            // Mark as processed in PostgreSQL
            await this.pool.query(
                `UPDATE outbox_entries
                 SET status = 'processed', processed_at = NOW(), attempts = $1
                 WHERE event_id = $2`,
                [newAttempts, event_id]
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error(`Failed to process outbox entry: ${event_id}`, undefined, error instanceof Error ? error : undefined);

            const newStatus = newAttempts >= this.maxRetries ? 'failed' : 'pending';

            // Mark as failed or increment attempts in PostgreSQL
            await this.pool.query(
                `UPDATE outbox_entries
                 SET status = $1, last_error = $2, attempts = $3
                 WHERE event_id = $4`,
                [newStatus, errorMessage, newAttempts, event_id]
            );

            if (newStatus === 'failed') {
                log.error(`Outbox entry ${event_id} marked as failed after ${newAttempts} attempts.`);
            }
        }
    }
}
