import { RabbitMQ } from "../config/rabbitmq.js";
import { QUEUES } from "./queues.js";
import type { Channel, ConsumeMessage } from "amqplib";
import { emailService } from "../shared/utils/email.service.js";
import { createLogger } from "../shared/utils/logger.js";

const log = createLogger("EmailConsumer");

/**
 * Interface corresponding to the expected payload schema of an email alert.
 */
interface EmailAlertPayload {
    to: string;
    data: {
        ruleName: string;
        metric: string;
        value: number;
        threshold: number;
    };
}

/**
 * Processes a single email alert message from the queue.
 * 
 * @param {Channel} channel - AMQP channel
 * @param {ConsumeMessage | null} msg - RabbitMQ message
 */
const processMessage = async (channel: Channel, msg: ConsumeMessage | null) => {
    if (!msg) return;

    let content: EmailAlertPayload;

    try {
        content = JSON.parse(msg.content.toString()) as EmailAlertPayload;
    } catch (err) {
        log.error("Invalid JSON in email queue, sending to DLQ", undefined, err instanceof Error ? err : undefined);
        channel.sendToQueue(QUEUES.DLQ, msg.content, { persistent: true });
        channel.ack(msg);
        return;
    }

    if (!content.to || !content.data || !content.data.ruleName) {
        log.error("Invalid email payload structure", content);
        channel.sendToQueue(QUEUES.DLQ, msg.content, { persistent: true });
        channel.ack(msg);
        return;
    }

    try {

        // Dispatch to nodemailer instance.
        const success = await emailService.sendAlert(content.to, content.data);

        if (!success) {
            log.warn(`Email delivery marked as failed for ${content.to}`);
        }

        channel.ack(msg);
    } catch (error) {
        log.error("Email processing worker encountered an exception", undefined, error instanceof Error ? error : undefined);
        channel.sendToQueue(QUEUES.DLQ, msg.content, { persistent: true });
        channel.ack(msg);
    }
};

/**
 * Creates and starts the asynchronous Email consumer queue listener.
 */
export const createEmailConsumer = async () => {
    const setupConsumer = async (channel: Channel) => {
        try {
            // Prefetch limits simultaneous processing tasks to not overwhelm SMTP
            await channel.prefetch(5);

            await channel.consume(QUEUES.EMAIL_ALERTS, (msg) => {
                return processMessage(channel, msg);
            });

            log.info("Email alerts consumer started");
        } catch (error) {
            log.error("Failed to setup Email consumer", undefined, error instanceof Error ? error : undefined);
        }
    };

    // Initial setup
    const initialChannel = await RabbitMQ.getChannel();
    await setupConsumer(initialChannel);

    // Listen for re-connections to re-subscribe
    RabbitMQ.emitter.on("reconnect", async (newChannel: Channel) => {
        log.info("RabbitMQ reconnected, re-subscribing email consumer...");
        await setupConsumer(newChannel);
    });
};
