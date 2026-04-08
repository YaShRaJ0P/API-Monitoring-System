import { RabbitMQ } from "../config/rabbitmq.js";
import { EXCHANGES, ROUTING_KEYS } from "./queues.js";
import { createLogger } from "../shared/utils/logger.js";

const log = createLogger("Publisher");

/**
 * Direct publish to the RabbitMQ telemetry exchange.
 * Used by the Circuit Breaker.
 * @param {unknown} message - Telemetry payload to publish
 * @returns {boolean} Whether the message was written to the buffer
 */
export const rawPublish = async (message: unknown) => {
    try {
        const channel = await RabbitMQ.getChannel();

        const response = channel.publish(
            EXCHANGES.TELEMETRY,
            ROUTING_KEYS.TELEMETRY,
            Buffer.from(JSON.stringify(message)),
            { persistent: true, headers: { "x-retry": 0 } }
        );

        return response;
    } catch (error) {
        log.error("Raw publish failed", undefined, error instanceof Error ? error : undefined);
        throw error;
    }
};