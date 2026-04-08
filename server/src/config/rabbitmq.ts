import amqp, { type Channel, type ChannelModel } from "amqplib";
import { EventEmitter } from "events";
import { AppError } from "../shared/errors/AppError.js";
import { EXCHANGES, QUEUES, ROUTING_KEYS } from "../queue/queues.js";
import { createLogger } from "../shared/utils/logger.js";

const log = createLogger("RabbitMQ");

/**
 * RabbitMQ singleton connection manager.
 * Handles connection pooling, topology setup, and automatic reconnection.
 */
export class RabbitMQ {
    private static connection: ChannelModel | null = null;
    private static channel: Channel | null = null;
    private static connectionPromise: Promise<Channel> | null = null;
    private static url: string | null = null;
    private static reconnectTimeout: NodeJS.Timeout | null = null;
    private static isShuttingDown = false;
    private static simulationMode = false;
    public static emitter = new EventEmitter();
    private static retryCount = 0;

    /**
     * Establishes a connection with exponential-backoff retry.
     * Safe for concurrent calls - deduplicates in-flight connects.
     * @param {string} url - AMQP connection URL
     * @returns {Promise<Channel>} AMQP channel
     * @throws {AppError} 500 after max retries exhausted
     */
    static async connect(url: string): Promise<Channel> {
        // Block all reconnect attempts while simulation mode is active.
        if (this.simulationMode) {
            throw new AppError(503, "[SimMode] RabbitMQ connection refused - simulation mode is active");
        }

        if (this.channel) {
            return this.channel;
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        if (!url) {
            throw new AppError(500, "RabbitMQ URL not defined");
        }

        this.url = url;
        this.isShuttingDown = false;

        this.connectionPromise = (async () => {
            try {
                this.connection = await amqp.connect(url);
                this.channel = await this.connection.createChannel();

                await this.setupTopology(this.channel);

                this.connection.on("error", (err) => {
                    log.error("Connection error", undefined, err);
                    this.handleDisconnect();
                });

                this.connection.on("close", () => {
                    if (!this.isShuttingDown) {
                        log.warn("Connection closed unexpectedly");
                        this.handleDisconnect();
                    }
                });

                log.info("Connected and topology verified");
                this.emitter.emit("reconnect", this.channel);
                return this.channel;
            } catch (error) {
                this.reset();
                const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);

                if (this.retryCount < 10) {
                    log.error(`Connection failed, retrying in ${delay}ms...`, { attempt: this.retryCount + 1 });
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.connect(url);
                }

                log.error("Max connection retries reached", undefined, error instanceof Error ? error : undefined);
                throw new AppError(500, "RabbitMQ connection failed");
            } finally {
                this.connectionPromise = null;
            }
        })();

        return this.connectionPromise;
    }

    /**
     * Returns the active channel, reconnecting if needed.
     * Throws immediately if simulation mode is active so the circuit breaker
     * correctly counts the failure and stays open.
     * @returns {Promise<Channel>} AMQP channel
     * @throws {AppError} 503 when simulation mode is on / 500 if not initialized
     */
    static async getChannel(): Promise<Channel> {
        if (this.simulationMode) {
            throw new AppError(503, "[SimMode] RabbitMQ unavailable - simulation mode is active");
        }

        if (this.channel) {
            return this.channel;
        }

        if (!this.url) {
            throw new AppError(500, "RabbitMQ not initialized. Call connect() first.");
        }

        return this.connect(this.url);
    }

    /**
     * Declares exchanges, queues, and bindings for the telemetry topology.
     * @param {Channel} channel - Active AMQP channel
     * @returns {Promise<void>}
     */
    private static async setupTopology(channel: Channel): Promise<void> {
        await channel.assertExchange(EXCHANGES.TELEMETRY, "direct", {
            durable: true,
        });

        await channel.assertQueue(QUEUES.TELEMETRY, {
            durable: true,
            arguments: {
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": QUEUES.DLQ,
            },
        });

        await channel.assertQueue(QUEUES.RETRY, {
            durable: true,
            arguments: {
                "x-dead-letter-exchange": EXCHANGES.TELEMETRY,
                "x-dead-letter-routing-key": ROUTING_KEYS.TELEMETRY,
            },
        });

        await channel.assertQueue(QUEUES.DLQ, {
            durable: true,
        });

        await channel.assertQueue(QUEUES.EMAIL_ALERTS, {
            durable: true,
            arguments: {
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": QUEUES.DLQ,
            },
        });

        await channel.bindQueue(
            QUEUES.TELEMETRY,
            EXCHANGES.TELEMETRY,
            ROUTING_KEYS.TELEMETRY
        );

        await channel.bindQueue(
            QUEUES.RETRY,
            EXCHANGES.TELEMETRY,
            ROUTING_KEYS.TELEMETRY_RETRY
        );

        await channel.bindQueue(
            QUEUES.EMAIL_ALERTS,
            EXCHANGES.TELEMETRY,
            ROUTING_KEYS.EMAIL_ALERT
        );
    }

    /**
     * Handles unexpected disconnection by scheduling a background reconnect.
     * Skipped when simulationMode is active so the "down" state can be held
     * for circuit breaker testing without an immediate auto-recovery.
     */
    private static handleDisconnect = () => {
        if (this.isShuttingDown) return;

        this.reset();

        if (this.simulationMode) {
            log.warn("[SimMode] Auto-reconnect suppressed - simulation mode is ON");
            return;
        }

        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

        this.reconnectTimeout = setTimeout(() => {
            log.info("Attempting background reconnection...");
            if (this.url) {
                this.connect(this.url).catch(err => {
                    log.error("Background reconnection failed", undefined, err);
                });
            }
        }, 5000);
    };

    /**
     * Enables or disables simulation mode.
     * While enabled, disconnection will NOT trigger auto-reconnect,
     * allowing the circuit breaker open state to be held for testing.
     * @param {boolean} on - True to enable, false to disable
     */
    static setSimulationMode(on: boolean): void {
        this.simulationMode = on;
        log.info(`Simulation mode ${on ? "ENABLED" : "DISABLED"}`);
    }

    /**
     * Returns whether simulation mode is currently active.
     * @returns {boolean}
     */
    static getSimulationMode(): boolean {
        return this.simulationMode;
    }

    /**
     * Resets internal connection state.
     */
    private static reset() {
        this.connection = null;
        this.channel = null;
        this.connectionPromise = null;
    }

    /**
     * Disconnects gracefully, closing channel and connection.
     * @returns {Promise<void>}
     */
    static async disconnect(): Promise<void> {
        this.isShuttingDown = true;
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

        try {
            if (this.channel) {
                await this.channel.close();
            }

            if (this.connection) {
                await this.connection.close();
            }

            this.reset();
            log.info("Disconnected gracefully");
        } catch (error) {
            log.error("Disconnection failed", undefined, error instanceof Error ? error : undefined);
        }
    }

    /**
     * Returns the current connection status.
     * @returns {"connected" | "connecting" | "disconnected"}
     */
    static getStatus(): "connected" | "connecting" | "disconnected" {
        if (this.connectionPromise) return "connecting";
        if (!this.connection || !this.channel) return "disconnected";
        return "connected";
    }
}
