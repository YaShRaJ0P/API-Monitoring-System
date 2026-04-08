import { createClient, type RedisClientType } from "redis";
import { config } from "../config.js";
import { AppError } from "../../shared/errors/AppError.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("Redis");

/**
 * Redis singleton connection manager.
 * Provides a shared client instance for caching and rate limiting.
 */
export class Redis {
    private static client: RedisClientType | null = null;
    private static retryCount = 0;

    /**
     * Establishes a Redis connection.
     * @returns {Promise<RedisClientType>} Connected Redis client
     * @throws {AppError} 500 if URI is missing or connection fails
     */
    static async connect(): Promise<RedisClientType> {
        if (this.client) {
            return this.client;
        }

        const uri = config.db.redis.uri;

        if (!uri) {
            throw new AppError(500, "Redis URI is not defined");
        }

        try {
            this.client = createClient({
                url: uri,
                socket: { connectTimeout: 5000 },
            });

            this.client.on("error", (err) => {
                log.error("Redis error", undefined, err);
            });

            await this.client.connect();
            log.info("Redis connected");
            return this.client;
        } catch (error) {
            log.error("Redis connection failed", undefined, error instanceof Error ? error : undefined);
            const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);

            if (this.retryCount < 10) {
                log.error(`Connection failed, retrying in ${delay}ms...`, { attempt: this.retryCount + 1 });
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.connect();
            }

            throw new AppError(500, "Redis connection failed", error);
        }
    }

    /**
     * Returns the active Redis client.
     * @returns {RedisClientType} Redis client instance
     * @throws {AppError} 500 if not yet initialized
     */
    static getClient(): RedisClientType {
        if (!this.client) {
            throw new AppError(500, "Redis not initialized. Call connect() first.");
        }
        return this.client;
    }

    /**
     * Disconnects from Redis gracefully.
     * @returns {Promise<void>}
     * @throws {AppError} 500 if disconnection fails
     */
    static async disconnect(): Promise<void> {
        try {
            if (this.client && this.client.isOpen) {
                await this.client.quit();
                this.client = null;
                log.info("Redis disconnected");
            }
        } catch (error) {
            log.error("Redis disconnection failed", undefined, error instanceof Error ? error : undefined);
            throw new AppError(500, "Redis disconnection failed", error);
        }
    }

    /**
     * Returns the current connection status.
     * @returns {"connected" | "disconnected"}
     */
    static getStatus(): "connected" | "disconnected" {
        if (!this.client || !this.client.isOpen) return "disconnected";
        return "connected";
    }
}
