import { createRequire } from "module";
import type CircuitBreakerType from "opossum";
import { rawPublish } from "../queue/publisher.js";
import { createLogger } from "../shared/utils/logger.js";
import type Redis from "ioredis";

const require = createRequire(import.meta.url);
const CircuitBreaker = require("opossum") as typeof CircuitBreakerType;

const log = createLogger("Circuit");

const BUFFER_KEY = "telemetry_buffer";
const DEAD_BUFFER_KEY = "telemetry_buffer_dead";

const BATCH_SIZE = 50;

// ---- Types ----
interface BufferedMessage {
    payload: unknown;
    attempts: number;
    nextRetry?: number;
}

export class Circuit {
    private breaker: CircuitBreakerType<[unknown], boolean>;
    private redis: Redis;
    private isReplaying = false;
    private hasLoggedReject = false;
    private shutdownRequested = false;

    constructor(redis: Redis) {
        this.redis = redis;

        this.breaker = new CircuitBreaker(rawPublish, {
            timeout: false,
            errorThresholdPercentage: 50,
            resetTimeout: 15000,
        });

        this.registerEvents();
        this.breaker.fallback(this.fallbackHandler);
    }

    public fire = async (payload: unknown): Promise<boolean> => {
        return this.breaker.fire(payload);
    };

    public getState(): "open" | "halfOpen" | "closed" {
        if (this.breaker.opened) return "open";
        if (this.breaker.halfOpen) return "halfOpen";
        return "closed";
    }

    public async getBufferCount(): Promise<number> {
        return this.redis.llen(BUFFER_KEY);
    }

    public async getDeadBufferCount(): Promise<number> {
        return this.redis.llen(DEAD_BUFFER_KEY);
    }

    public shutdown = async (): Promise<void> => {
        this.shutdownRequested = true;

        while (this.isReplaying) {
            log.debug("Waiting for replay to finish before shutdown...");
            await new Promise((r) => setTimeout(r, 200));
        }

        this.breaker.shutdown();
        log.debug("Circuit breaker shutdown complete");
    };

    private fallbackHandler = async (
        payload: unknown
    ): Promise<{ success: boolean; buffered: boolean }> => {
        log.warn("Fallback triggered - buffering message to Redis");

        const msg: BufferedMessage = {
            payload,
            attempts: 0,
            nextRetry: Date.now(),
        };

        await this.redis.rpush(BUFFER_KEY, JSON.stringify(msg));

        return { success: false, buffered: true };
    };

    private async replayRedisBuffer(): Promise<void> {
        if (this.isReplaying || this.shutdownRequested) return;

        this.isReplaying = true;
        const deferred: BufferedMessage[] = [];

        try {
            while (!this.shutdownRequested) {
                // ---- Batch fetch ----
                const batch = await this.redis.lrange(BUFFER_KEY, 0, BATCH_SIZE - 1);
                if (batch.length === 0) break;

                await this.redis.ltrim(BUFFER_KEY, batch.length, -1);

                for (const raw of batch) {
                    let msg: BufferedMessage;

                    // ---- JSON safety ----
                    try {
                        msg = JSON.parse(raw);
                    } catch {
                        log.error("Invalid JSON in buffer, skipping");
                        continue;
                    }

                    const now = Date.now();

                    if (msg.nextRetry && msg.nextRetry > now) {
                        deferred.push(msg);
                        continue;
                    }

                    try {
                        // ---- Direct publish (avoid circuit loop) ----
                        await rawPublish(msg.payload);

                        // throttle
                        await new Promise((r) => setTimeout(r, 50));

                    } catch {
                        msg.attempts += 1;

                        if (msg.attempts >= 5) {
                            await this.redis.rpush(
                                DEAD_BUFFER_KEY,
                                JSON.stringify(msg)
                            );

                            log.error("Moved message to dead buffer", {
                                attempts: msg.attempts,
                            });

                            continue;
                        }

                        const baseDelay = Math.min(
                            1000 * 2 ** msg.attempts,
                            30000
                        );

                        const jitter = Math.random() * 500;

                        msg.nextRetry = Date.now() + baseDelay + jitter;
                        deferred.push(msg);
                    }
                }
            }
        } finally {
            // ---- Push deferred back using pipeline ----
            if (deferred.length > 0) {
                const pipeline = this.redis.pipeline();

                for (const msg of deferred) {
                    pipeline.rpush(BUFFER_KEY, JSON.stringify(msg));
                }

                await pipeline.exec();

                log.debug(
                    `Deferred ${deferred.length} message(s) back to Redis buffer`
                );
            }

            this.isReplaying = false;
        }
    }

    public forceClose(): void {
        log.debug("Circuit breaker force-closed by admin restore");
        this.breaker.close();
    }

    private registerEvents() {
        this.breaker.on("open", () => {
            log.warn("Circuit breaker OPENED - RabbitMQ unreachable");
        });

        this.breaker.on("halfOpen", () => {
            log.debug("Circuit breaker HALF-OPEN - replaying buffer");
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
                log.warn("Requests short-circuited to Redis buffer");
                this.hasLoggedReject = true;
            }
        });
    }
}

// ---- Singleton ----
export class CircuitRegistry {
    private static instance: Circuit | null = null;

    static register(circuit: Circuit): void {
        this.instance = circuit;
    }

    static get(): Circuit | null {
        return this.instance;
    }
}
