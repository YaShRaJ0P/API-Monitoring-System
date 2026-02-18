import { MongoDB } from "./mongo.js";
import { PostgreSQL } from "./postgres.js";
import { Redis } from "./redis.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("DatabaseManager");

/**
 * Unified database configuration manager.
 * Provides single-call connection/disconnection for all data stores.
 */
export class DataBaseConfig {
    private static isInitialized = false;

    /**
     * Connects to all databases in parallel (Mongo, Postgres, Redis).
     * @returns {Promise<void>}
     * @throws Re-throws the first connection error to prevent server startup
     */
    static async connectDB(): Promise<void> {
        if (this.isInitialized) {
            log.warn("Databases are already initialized");
            return;
        }

        try {
            // we parallelize connections for faster startup
            await Promise.all([
                MongoDB.connect(),
                PostgreSQL.connect(),
                Redis.connect()
            ]);

            this.isInitialized = true;
            log.info("All databases connected successfully");
        } catch (error) {
            log.error("Failed to connect to one or more databases", undefined, error instanceof Error ? error : undefined);
            throw error; // Re-throw to prevent server startup
        }
    }

    /**
     * Returns the PostgreSQL connection pool.
     * @returns {Pool} pg Pool instance
     */
    static getPostgresPool() {
        return PostgreSQL.getPool();
    }

    /**
     * Returns the Redis client instance.
     * @returns {RedisClientType} Redis client
     */
    static getRedisClient() {
        return Redis.getClient();
    }

    /**
     * Disconnects all databases gracefully.
     * Uses `allSettled` to ensure all disconnect attempts are made.
     * @returns {Promise<void>}
     */
    static async disconnect(): Promise<void> {
        try {
            await Promise.allSettled([
                MongoDB.disconnect(),
                PostgreSQL.disconnect(),
                Redis.disconnect()
            ]);

            this.isInitialized = false;
            log.info("All databases disconnected");
        } catch (error) {
            log.error("Error during database disconnection", undefined, error instanceof Error ? error : undefined);
        }
    }

    /**
     * Re-exports individual database classes for direct access.
     */
    static get MongoDB() { return MongoDB; }
    static get PostgreSQL() { return PostgreSQL; }
    static get Redis() { return Redis; }
}

// Export individual classes as well
export { MongoDB, PostgreSQL, Redis };
