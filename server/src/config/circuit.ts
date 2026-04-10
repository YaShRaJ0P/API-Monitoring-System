import { createRequire } from "module";
import type CircuitBreakerType from "opossum";
import type { RedisClientType } from "redis";
import { rawPublish } from "../queue/publisher.js";
import { createLogger } from "../shared/utils/logger.js";

const require = createRequire(import.meta.url);
const CircuitBreaker = require("opossum") as typeof CircuitBreakerType;

const log = createLogger("Circuit");

const BUFFER_KEY = "telemetry_buffer";
const DEAD_BUFFER_KEY = "telemetry_buffer_dead";

// Type for buffered messages
interface BufferedMessage {
    payload: unknown;
    attempts: number;
    nextRetry?: number; // timestamp in ms
}

/**
 * Circuit breaker wrapper around the RabbitMQ publisher.
 * Falls back to Redis buffering when the circuit opens,
 * and replays buffered messages once recovered.
 */
export class Circuit {
    private breaker: CircuitBreakerType<[unknown], boolean>;
    private redis: RedisClientType;
    private isReplaying = false;
    private hasLoggedReject = false;
    private shutdownRequested = false;

    constructor(redis: RedisClientType) {
        this.redis = redis;

        const options: CircuitBreakerType.Options = {
            timeout: 2000,
            errorThresholdPercentage: 50,
            resetTimeout: 15000,
        };

        this.breaker = new CircuitBreaker(rawPublish, options);

        this.registerEvents();
        this.breaker.fallback(this.fallbackHandler);
    }

    /**
     * Fires a message through the circuit breaker.
     * @param {unknown} payload - Telemetry payload to publish
     * @returns {Promise<boolean>} Whether the publish succeeded
     */
    public fire = async (payload: unknown): Promise<boolean> => {
        return this.breaker.fire(payload);
    };

    /**
     * Returns the current circuit breaker state.
     * @returns {"open" | "halfOpen" | "closed"}
     */
    public getState(): "open" | "halfOpen" | "closed" {
        if (this.breaker.opened) return "open";
        if (this.breaker.halfOpen) return "halfOpen";
        return "closed";
    }

    /**
     * Returns the number of messages currently buffered in Redis.
     * @returns {Promise<number>}
     */
    public async getBufferCount(): Promise<number> {
        return this.redis.lLen(BUFFER_KEY);
    }

    /**
     * Returns the number of messages in the dead Redis buffer (exhausted retries).
     * @returns {Promise<number>}
     */
    public async getDeadBufferCount(): Promise<number> {
        return this.redis.lLen(DEAD_BUFFER_KEY);
    }

    /**
     * Shuts down the circuit breaker gracefully.
     * Waits for any in-flight replay to complete before closing.
     * @returns {Promise<void>}
     */
    public shutdown = async (): Promise<void> => {
        this.shutdownRequested = true;

        // Wait for any ongoing replay to finish
        while (this.isReplaying) {
            log.debug("Waiting for replay to finish before shutdown...");
            await new Promise((r) => setTimeout(r, 200));
        }

        this.breaker.shutdown();
        log.debug("Circuit breaker shutdown complete");
    };

    /**
     * Fallback handler - buffers the message in Redis when the circuit is open.
     * @param {unknown} payload - Telemetry payload that failed to publish
     * @returns {Promise<{ success: boolean, buffered: boolean }>}
     */
    private fallbackHandler = async (payload: unknown): Promise<{ success: boolean; buffered: boolean; }> => {
        log.warn("Fallback triggered - buffering message to Redis");

        const msg: BufferedMessage = {
            payload,
            attempts: 0,
            nextRetry: Date.now(),
        };

        await this.redis.rPush(BUFFER_KEY, JSON.stringify(msg));
        return { success: false, buffered: true };
    };

    /**
     * Replays buffered messages from Redis with exponential backoff.
     *
     * @returns {Promise<void>}
     */
    private async replayRedisBuffer(): Promise<void> {
        if (this.isReplaying || this.shutdownRequested) {
            return;
        }

        this.isReplaying = true;
        const deferred: BufferedMessage[] = [];

        try {
            while (!this.shutdownRequested) {
                const raw = await this.redis.lPop(BUFFER_KEY);
                if (!raw) break; // buffer fully drained for this pass

                const msg: BufferedMessage = JSON.parse(raw);
                const now = Date.now();

                // Not ready yet - park it locally, keep processing the rest
                if (msg.nextRetry && msg.nextRetry > now) {
                    deferred.push(msg);
                    continue;
                }

                try {
                    await this.fire(msg.payload);
                    // Throttle to protect RabbitMQ from a burst after recovery
                    await new Promise(r => setTimeout(r, 50));

                } catch (error) {
                    msg.attempts += 1;

                    if (msg.attempts >= 5) {
                        // Exhausted - move to dead buffer permanently
                        await this.redis.rPush(DEAD_BUFFER_KEY, JSON.stringify(msg));
                        log.error("Moved message to dead buffer after max replay attempts",
                            { attempts: msg.attempts });
                        continue;
                    }

                    // Exponential backoff with jitter - defer for next replay pass
                    const baseDelay = Math.min(1000 * 2 ** msg.attempts, 30000);
                    const jitter = Math.random() * 500;
                    msg.nextRetry = Date.now() + baseDelay + jitter;
                    deferred.push(msg);
                }
            }
        } finally {
            // Push all deferred messages back in one batch
            if (deferred.length > 0) {
                const pipeline = deferred.map(m => JSON.stringify(m));
                await this.redis.rPush(BUFFER_KEY, pipeline);
                log.debug(`Deferred ${deferred.length} not-yet-ready message(s) back to Redis buffer`);
            }
            this.isReplaying = false;
        }
    }

    /**
     * Forces the circuit breaker into the CLOSED state immediately.
     */
    public forceClose(): void {
        log.debug("Circuit breaker force-closed by admin restore");
        this.breaker.close();
    }

    /**
     * Registers event handlers for circuit breaker state transitions.
     */
    private registerEvents() {
        this.breaker.on("open", () => {
            log.warn("Circuit breaker OPENED - RabbitMQ unreachable");
        });

        this.breaker.on("halfOpen", () => {
            log.debug("Circuit breaker HALF-OPEN - testing recovery with a buffered probe");
            this.replayRedisBuffer();
        });

        this.breaker.on("close", () => {
            this.hasLoggedReject = false;
            log.debug("Circuit breaker CLOSED - RabbitMQ recovered");
            this.replayRedisBuffer();
        });

        this.breaker.on("timeout", () => {
            log.warn("Circuit breaker TIMEOUT");
        });

        this.breaker.on("reject", () => {
            if (!this.hasLoggedReject) {
                log.warn("Requests are being short-circuited to fallback (Redis buffer)");
                this.hasLoggedReject = true;
            }
        });
    }
}

/**
 * Singleton Registry for the active Circuit instance.
 */
export class CircuitRegistry {
    private static instance: Circuit | null = null;

    /**
     * Stores the Circuit instance created in IngestionRouter.
     * @param {Circuit} circuit - The active circuit breaker instance
     */
    static register(circuit: Circuit): void {
        this.instance = circuit;
    }

    /**
     * Returns the registered Circuit instance.
     * @returns {Circuit | null}
     */
    static get(): Circuit | null {
        return this.instance;
    }
}
