import mongoose from "mongoose";
import { AppError } from "../../shared/errors/AppError.js";
import { config } from "../config.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("MongoDB");

/**
 * MongoDB singleton connection manager.
 * Uses Mongoose with connection pooling and automatic reconnect handling.
 */
export class MongoDB {
    private static instance: typeof mongoose | null = null;
    private static connectionPromise: Promise<typeof mongoose> | null = null;
    private static retryCount: number = 0;

    /**
     * Establishes a MongoDB connection (safe for concurrent calls).
     * @returns {Promise<typeof mongoose>} Mongoose instance
     * @throws {AppError} 500 if URI is missing or connection fails
     */
    static async connect(): Promise<typeof mongoose> {
        if (this.instance) {
            return this.instance;
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        const uri = config.db.mongo.uri;

        if (!uri) {
            throw new AppError(500, "MongoDB URI is not defined");
        }

        this.connectionPromise = (async () => {
            try {
                const mongooseInstance = await mongoose.connect(uri, {
                    maxPoolSize: 10,
                    connectTimeoutMS: 5000,
                });

                this.instance = mongooseInstance;

                mongoose.connection.on("error", () => MongoDB.handleDisconnect());
                mongoose.connection.on("close", () => MongoDB.handleDisconnect());

                log.debug("MongoDB connected");

                return mongooseInstance;
            } catch (error) {
                this.reset();
                const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);

                if (this.retryCount < 10) {
                    log.error(`Connection failed, retrying in ${delay}ms...`, { attempt: this.retryCount + 1 });
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.connect();
                }

                log.error("MongoDB connection failed", undefined, error instanceof Error ? error : undefined);
                throw new AppError(500, "MongoDB connection failed", error);
            } finally {
                this.connectionPromise = null;
            }
        })();

        return this.connectionPromise;
    }

    /**
     * Returns the active Mongoose instance.
     * @returns {typeof mongoose} Mongoose instance
     * @throws {AppError} 500 if not yet initialized
     */
    static getInstance(): typeof mongoose {
        if (!this.instance) {
            throw new AppError(500, "MongoDB not initialized.");
        }

        return this.instance;
    }

    /**
     * Disconnects from MongoDB and resets internal state.
     * @returns {Promise<void>}
     * @throws {AppError} 500 if disconnection fails
     */
    static async disconnect(): Promise<void> {
        try {
            if (this.instance) {
                await this.instance.disconnect();
                log.debug("MongoDB disconnected");
            }

            this.reset();
        } catch (error) {
            log.error("MongoDB disconnection failed", undefined, error instanceof Error ? error : undefined);
            throw new AppError(500, "MongoDB disconnection failed", error);
        }
    }

    /**
     * Returns the current connection status.
     * @returns {"connected" | "connecting" | "disconnected"}
     */
    static getStatus(): "connected" | "connecting" | "disconnected" {
        if (this.connectionPromise) return "connecting";
        if (!this.instance || mongoose.connection.readyState !== 1) return "disconnected";
        return "connected";
    }

    /**
     * Handles unexpected MongoDB disconnection by resetting state.
     */
    private static handleDisconnect() {
        log.warn("MongoDB connection lost");
        MongoDB.reset();
    }

    /**
     * Resets internal connection state.
     */
    private static reset() {
        this.instance = null;
        this.connectionPromise = null;
    }
}
