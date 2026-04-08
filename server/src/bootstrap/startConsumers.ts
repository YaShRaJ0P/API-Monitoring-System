import { createTelemetryConsumer } from "../queue/consumer.js";
import { createEmailConsumer } from "../queue/email.consumer.js";
import { MetricsStore } from "../modules/processing/metrics-store.js";
import { MongoProjector } from "../modules/processing/mongo-projector.js";
import { ProcessingService } from "../modules/processing/processing.service.js";
import { OutboxProcessor } from "../modules/processing/outbox-processor.js";
import { AlertWorker } from "../modules/alerts/alerts.job.js";
import { DataBaseConfig } from "../config/db/index.js";
import { createLogger } from "../shared/utils/logger.js";
import { AppError } from "../shared/errors/AppError.js";
import { config } from "../config/config.js";

const log = createLogger("Bootstrap");

let outboxProcessor: OutboxProcessor | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;
let alertsJob: AlertWorker | null = null;

/**
 * Root of Background Processors
 */
export const startConsumers = async () => {
    try {
        log.info("Initializing background consumers...");

        const pool = DataBaseConfig.getPostgresPool();
        const metricsStore = new MetricsStore(pool);
        const processingService = new ProcessingService(metricsStore);

        // Start telemetry consumer worker
        await createTelemetryConsumer(processingService);

        // Start asynchronous Email consumer worker
        await createEmailConsumer();

        // For Outbox Projection
        const mongoProjector = new MongoProjector();
        outboxProcessor = new OutboxProcessor(pool, mongoProjector);

        outboxProcessor.start();

        // -- Alerts Job --
        alertsJob = new AlertWorker();
        alertsJob.start(config.worker.alert.interval);

        // -- Retention Cleanup (Minute Metrics) --
        // Run to delete minute_metrics at each interval
        cleanupInterval = setInterval(async () => {
            try {
                const result = await pool.query(
                    "DELETE FROM minute_metrics WHERE minute_bucket < NOW() - INTERVAL '24 hours'"
                );
                log.info(`Retention cleanup: deleted ${result.rowCount} old minute entries`);
            } catch (err) {
                log.error("Retention cleanup failed", undefined, err instanceof Error ? err : undefined);
            }
        }, config.worker.minuteMetrics.interval);


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
