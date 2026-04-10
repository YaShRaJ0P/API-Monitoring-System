import { RabbitMQ } from "../config/rabbitmq.js";
import { QUEUES } from "./queues.js";
import FailedJobsModel from "../models/FailedJobsModel.js";
import type { Channel, ConsumeMessage } from "amqplib";
import type { ProcessingService } from "../modules/processing/processing.service.js";
import { validateIngestion } from "../modules/ingestion/ingestion.validator.js";
import { createLogger } from "../shared/utils/logger.js";
import { AppError } from "../shared/errors/AppError.js";

const log = createLogger("Consumer");

// ---- Constants ----
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5000; //5s

/**
 * Calculates exponential backoff delay for message retries.
 * @param {number} retryCount - Current retry attempt
 * @returns {number} Delay in milliseconds
 */
const getBackoffTime = (retryCount: number): number =>
    BASE_DELAY_MS * Math.pow(2, retryCount);

/**
 * Sends a message to the retry queue with exponential backoff TTL.
 * @param {Channel} channel - AMQP channel
 * @param {unknown} content - Message payload
 * @param {number} retryCount - Current retry attempt
 */
const sendToRetryQueue = (channel: Channel, content: unknown, retryCount: number) => {
    const ttl = getBackoffTime(retryCount);

    channel.sendToQueue(QUEUES.RETRY, Buffer.from(JSON.stringify(content)), {
        headers: { "x-retry": retryCount + 1 },
        expiration: ttl.toString(),
        persistent: true,
    });

    log.debug(`Retry scheduled in ${ttl / 1000}s (attempt ${retryCount + 1})`);
};

/**
 * Sends a failed message to the dead letter queue and persists it in MongoDB.
 * @param {Channel} channel - AMQP channel
 * @param {unknown} content - Original message payload
 * @param {unknown} error - The error that caused the failure
 * @param {number} retryCount - Number of retries attempted
 * @returns {Promise<void>}
 */
const sendToDLQ = async (
    channel: Channel,
    content: unknown,
    error: unknown,
    retryCount: number,
): Promise<void> => {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const failedMessage = {
        payload: content,
        error: errorMessage,
        retries: retryCount + 1,
        failedAt: new Date(),
    };

    channel.sendToQueue(QUEUES.DLQ, Buffer.from(JSON.stringify(failedMessage)), {
        persistent: true,
    });

    // Store in MongoDB
    try {
        await FailedJobsModel.create({
            payload: content,
            errorMessage: errorMessage,
            retries: retryCount + 1,
            queue: QUEUES.TELEMETRY,
            createdAt: new Date(),
        });
    } catch (dbError) {
        log.warn("Failed to store failed job in MongoDB", dbError);
    }

    log.error("Message sent to DLQ and stored in MongoDB");
};

/**
 * Processes a single message from the telemetry queue.
 * Validates schema, delegates to ProcessingService, and handles retries/DLQ.
 * @param {Channel} channel - AMQP channel
 * @param {ProcessingService} processingService - Injected processing service
 * @param {ConsumeMessage | null} msg - RabbitMQ message or null
 * @returns {Promise<void>}
 */
const processMessage = async (channel: Channel, processingService: ProcessingService, msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;

    let content;

    try {
        content = JSON.parse(msg.content.toString());
    } catch (err) {
        log.error("Invalid JSON, sending to DLQ");
        await sendToDLQ(channel, msg.content.toString(), err, 0);
        channel.ack(msg);
        return;
    }

    const retryCount = msg.properties.headers?.["x-retry"] || 0;

    // Validate message schema before processing
    const validationResult = validateIngestion(content);
    if (!validationResult.success) {
        log.error("Invalid message schema", validationResult.error);
        await sendToDLQ(channel, content, new AppError(400, "Schema validation failed"), retryCount);
        channel.ack(msg);
        return;
    }

    try {
        // Business logic
        await processingService.processTelemetry(validationResult.data);
        channel.ack(msg);
    } catch (error) {
        log.error("Processing failed", undefined, error instanceof Error ? error : undefined);

        if (retryCount < MAX_RETRIES) {
            sendToRetryQueue(channel, content, retryCount);
            channel.ack(msg); // Ack original message so it doesn't loop instantly
        } else {
            // Max retries reached → DLQ
            await sendToDLQ(channel, content, error, retryCount);
            channel.ack(msg);
        }
    }
};

// ---- Consumer Starter ----

/**
 * Creates and starts the telemetry consumer.
 * @param {ProcessingService} processingService
 */
export const createTelemetryConsumer = async (processingService: ProcessingService) => {
    const setupConsumer = async (channel: Channel) => {
        try {
            await channel.prefetch(1);
            await channel.consume(QUEUES.TELEMETRY, (msg) => {
                return processMessage(channel, processingService, msg);
            });
            log.debug("Telemetry consumer started");
        } catch (error) {
            log.error("Failed to setup telemetry consumer", undefined, error instanceof Error ? error : undefined);
        }
    };

    // Initial setup
    const initialChannel = await RabbitMQ.getChannel();
    await setupConsumer(initialChannel);

    // Listen for re-connections to re-subscribe
    RabbitMQ.emitter.on("reconnect", async (newChannel: Channel) => {
        log.debug("RabbitMQ reconnected, re-subscribing telemetry consumer...");
        await setupConsumer(newChannel);
    });
};
