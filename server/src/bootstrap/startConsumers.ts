import { createTelemetryConsumer } from "../queue/consumer.js";
import { EventStore } from "../modules/processing/event-store.js";
import { ProcessingService } from "../modules/processing/processing.service.js";
import { MetricsProjector } from "../modules/processing/metrics-projector.js";
import { OutboxProcessor } from "../modules/processing/outbox-processor.js";
import { AlertsJob } from "../modules/alerts/alerts.job.js";
import { DataBaseConfig } from "../config/db/index.js";
import { createLogger } from "../shared/utils/logger.js";
import { AppError } from "../shared/errors/AppError.js";

const log = createLogger("Bootstrap");

/** OutboxProcessor reference for graceful shutdown */
let outboxProcessor: OutboxProcessor | null = null;
/** Retention cleanup interval reference */
let cleanupInterval: NodeJS.Timeout | null = null;
/** Alerts job reference */
let alertsJob: AlertsJob | null = null;

/**
 * Composition root for background processes.
 * Creates all dependencies and wires them together via DI.
 */
export const startConsumers = async () => {
    try {
        log.info("Initializing background consumers...");

        // ── Command side (CQRS) ──
        const eventStore = new EventStore();
        const processingService = new ProcessingService(eventStore);

        // Start telemetry consumer (RabbitMQ → EventStore)
        await createTelemetryConsumer(processingService);

        // ── Query side (CQRS Projection) ──
        const pool = DataBaseConfig.getPostgresPool();
        const projector = new MetricsProjector(pool);
        outboxProcessor = new OutboxProcessor(projector);


        // Start outbox polling (MongoDB outbox → PostgreSQL metrics)
        outboxProcessor.start();

        // ── Alerts Job ──
        alertsJob = new AlertsJob();
        alertsJob.start(); // 1-minute interval

        // ── Retention Cleanup (Minute Metrics) ──
        // Run every hour to delete minute_metrics older than 24h
        cleanupInterval = setInterval(async () => {
            try {
                const result = await pool.query(
                    "DELETE FROM minute_metrics WHERE minute_bucket < NOW() - INTERVAL '24 hours'"
                );
                log.info(`Retention cleanup: deleted ${result.rowCount} old minute entries`);
            } catch (err) {
                log.error("Retention cleanup failed", undefined, err instanceof Error ? err : undefined);
            }
        }, 60 * 60 * 1000); // 1 hour

        log.info("Retention cleanup job scheduled (every 1h)");

        log.info("All consumers and processors are up and running");
    } catch (error) {
        log.error("Failed to start consumers", undefined, error instanceof Error ? error : undefined);
        throw new AppError(500, "Failed to start consumers");
    }
};

/**
 * Stops the outbox processor gracefully.
 * Called during server shutdown.
 */
export const stopOutboxProcessor = async () => {
    if (outboxProcessor) {
        await outboxProcessor.stop();
    }
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }
    if (alertsJob) {
        alertsJob.stop();
    }
};
