import OutboxEntry from "../../models/OutboxEntry.js";
import type { MetricsProjector } from "./metrics-projector.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("OutboxProcessor");

// ── Configuration ──
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

/**
 * Polls MongoDB outbox for pending entries and projects them
 * to PostgreSQL via MetricsProjector.
 *
 * Runs as a background process alongside the RabbitMQ consumer.
 * If PostgreSQL is down, entries remain pending and are retried
 * on the next poll — guaranteeing eventual consistency.
 */
export class OutboxProcessor {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private isProcessing = false;

    constructor(private readonly projector: MetricsProjector) { }

    /**
     * Starts the outbox polling loop.
     * Safe to call multiple times — will not create duplicate intervals.
     */
    start(): void {
        if (this.intervalId) {
            log.warn("OutboxProcessor is already running");
            return;
        }

        log.info(`OutboxProcessor started (polling every ${POLL_INTERVAL_MS / 1000}s)`);

        this.intervalId = setInterval(() => {
            this.processBatch().catch((err) => {
                log.error("Outbox batch processing error", undefined, err instanceof Error ? err : undefined);
            });
        }, POLL_INTERVAL_MS);
    }

    /**
     * Stops the polling loop gracefully.
     * Waits for any in-flight batch to finish before returning.
     */
    async stop(): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Wait for any in-flight processing to complete
        while (this.isProcessing) {
            log.info("Waiting for outbox batch to finish...");
            await new Promise((r) => setTimeout(r, 200));
        }

        log.info("OutboxProcessor stopped");
    }

    /**
     * Processes a batch of pending outbox entries.
     * Each entry is projected independently — a single failure
     * doesn't block the rest of the batch.
     */
    private async processBatch(): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const entries = await OutboxEntry.find({ status: "pending" })
                .sort({ createdAt: 1 })
                .limit(BATCH_SIZE);

            if (entries.length === 0) return;

            log.debug(`Processing ${entries.length} outbox entries`);

            for (const entry of entries) {
                try {
                    await this.projector.project(entry.payload as Record<string, unknown>);

                    entry.status = "processed";
                    entry.processedAt = new Date();
                    await entry.save();
                } catch (error) {
                    entry.attempts += 1;
                    entry.lastError = error instanceof Error ? error.message : String(error);

                    if (entry.attempts >= MAX_ATTEMPTS) {
                        entry.status = "failed";
                        log.error(`Outbox entry ${entry.event_id} failed permanently after ${MAX_ATTEMPTS} attempts`);
                    } else {
                        log.warn(`Outbox entry ${entry.event_id} failed (attempt ${entry.attempts}/${MAX_ATTEMPTS})`);
                    }

                    await entry.save();
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }
}
