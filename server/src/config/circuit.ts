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
    public fire = async (payload: unknown) => {
        return this.breaker.fire(payload);
    };

    /**
     * Shuts down the circuit breaker gracefully.
     * Waits for any in-flight replay to complete before closing.
     * @returns {Promise<void>}
     */
    public shutdown = async () => {
        this.shutdownRequested = true;

        // Wait for any ongoing replay to finish
        while (this.isReplaying) {
            log.info("Waiting for replay to finish before shutdown...");
            await new Promise((r) => setTimeout(r, 200));
        }

        this.breaker.shutdown();
        log.info("Circuit breaker shutdown complete");
    };

    /**
     * Fallback handler — buffers the message in Redis when the circuit is open.
     * @param {unknown} payload - Telemetry payload that failed to publish
     * @returns {Promise<{ success: boolean, buffered: boolean }>}
     */
    private fallbackHandler = async (payload: unknown) => {
        log.warn("Fallback triggered — buffering message to Redis");

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
     * Messages exceeding max attempts are moved to the dead buffer.
     * @returns {Promise<void>}
     */
    private async replayRedisBuffer() {
        if (this.isReplaying || this.shutdownRequested) return;
        this.isReplaying = true;

        try {
            while (!this.shutdownRequested) {
                const raw = await this.redis.lPop(BUFFER_KEY);
                if (!raw) break;

                const msg: BufferedMessage = JSON.parse(raw);
                const now = Date.now();

                // Check if it's time to retry
                if (msg.nextRetry && msg.nextRetry > now) {
                    await this.redis.rPush(BUFFER_KEY, JSON.stringify(msg));
                    break; // stop batch, retry later
                }

                try {
                    await this.fire(msg.payload);

                    // Throttle to avoid overloading RabbitMQ
                    await new Promise((r) => setTimeout(r, 50));
                } catch (error) {
                    log.error(
                        "Failed to replay message",
                        undefined,
                        error instanceof Error ? error : undefined
                    );

                    msg.attempts += 1;

                    if (msg.attempts >= 5) {
                        await this.redis.rPush(DEAD_BUFFER_KEY, JSON.stringify(msg));
                        log.error("Moved message to dead buffer after max attempts");
                        continue;
                    }

                    // Exponential backoff
                    msg.nextRetry = now + Math.min(1000 * 2 ** msg.attempts, 30000);
                    await this.redis.rPush(BUFFER_KEY, JSON.stringify(msg));
                }
            }
        } finally {
            this.isReplaying = false;
        }
    }

    /**
     * Registers event handlers for circuit breaker state transitions.
     */
    private registerEvents() {
        this.breaker.on("open", () => {
            log.warn("Circuit breaker OPENED — RabbitMQ unreachable");
        });

        this.breaker.on("halfOpen", () => {
            log.info("Circuit breaker HALF-OPEN — testing recovery");
        });

        this.breaker.on("close", () => {
            this.hasLoggedReject = false;
            log.info("Circuit breaker CLOSED — RabbitMQ recovered");
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
