import { createApp } from "./app.js";
import { config } from "./config/config.js";
import { DataBaseConfig } from "./config/db/index.js";
import { RabbitMQ } from "./config/rabbitmq.js";
import { createLogger } from "./shared/utils/logger.js";
import { startConsumers, stopOutboxProcessor } from "./bootstrap/startConsumers.js";

const log = createLogger("Server");

const startServer = async (): Promise<void> => {
    try {
        log.info("Starting API Monitoring System...");

        // 1. Connect all databases first
        await DataBaseConfig.connectDB();

        // 2. Initialize RabbitMQ
        await RabbitMQ.connect(config.db.rabbitmq.uri);

        // 3. Create Express app
        const app = createApp();

        // 4. Start background consumers
        await startConsumers();

        // 5. Start Express server
        app.listen(config.port, () => {
            log.info(`Server is running on port ${config.port}`, { env: config.NODE_ENV });
        });

        // ------ Graceful Shutdown ------
        const shutdown = async (signal: string) => {
            log.warn(`${signal} received. Shutting down gracefully...`);
            await stopOutboxProcessor();
            await RabbitMQ.disconnect();
            await DataBaseConfig.disconnect();
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

    } catch (error) {
        log.error("Fatal startup error", undefined, error instanceof Error ? error : undefined);
        try {
            await RabbitMQ.disconnect();
            await DataBaseConfig.disconnect();
        } catch { /* ignore cleanup errors */ }
        process.exit(1);
    }
}

// ------ Global Error Safety Nets ------
process.on("unhandledRejection", (reason: unknown) => {
    log.error(
        "Unhandled Promise Rejection",
        undefined,
        reason instanceof Error ? reason : new Error(String(reason))
    );
});

process.on("uncaughtException", (error: Error) => {
    log.error("Uncaught Exception - process will exit", undefined, error);
    process.exit(1);
});

startServer();