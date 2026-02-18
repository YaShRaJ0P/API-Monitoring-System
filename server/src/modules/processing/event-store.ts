import RawEvent from "../../models/RawEvent.js";
import OutboxEntry from "../../models/OutboxEntry.js";
import type { IngestionType } from "../ingestion/ingestion.validator.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("EventStore");

/** MongoDB duplicate key error code */
const DUPLICATE_KEY_ERROR = 11000;

/**
 * Checks if an error is a MongoDB duplicate key error.
 * @param {unknown} error - The caught error
 * @returns {boolean} True if it's a duplicate key violation
 */
function isDuplicateKeyError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: number }).code === DUPLICATE_KEY_ERROR
    );
}

/**
 * Command-side of CQRS: stores raw telemetry events in MongoDB.
 * Also writes an outbox entry for eventual projection to PostgreSQL.
 *
 * Both writes target MongoDB, so they are within the same database
 * and avoid the partial-write drift risk of a dual-database write.
 *
 * Idempotent: if the same event_id is stored twice (e.g. RabbitMQ
 * redelivery), the duplicate is silently skipped.
 */
export class EventStore {
    /**
     * Stores a raw event and creates an outbox entry for projection.
     * Safe to call multiple times with the same event_id (idempotent).
     * @param {IngestionType} data - Validated telemetry payload
     * @returns {Promise<void>}
     */
    async store(data: IngestionType): Promise<void> {
        log.debug(`Storing event: ${data.event_id}`, { tenantId: data.tenant_id });

        // 1. Save raw event (source of truth)
        try {
            const rawEvent = new RawEvent({
                event_id: data.event_id,
                tenant_id: data.tenant_id,
                endpoint: data.endpoint,
                method: data.method,
                status: data.status,
                latency: data.latency,
                timestamp: new Date(data.timestamp),
                environment: data.environment,
                service: data.service,
                error: data.error,
            });
            await rawEvent.save();
            log.info(`Raw event stored: ${data.event_id}`);
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                log.info(`Duplicate event skipped (already processed): ${data.event_id}`);
                return; // Idempotent — outbox entry already exists too
            }
            throw error; // Re-throw non-duplicate errors for retry
        }

        // 2. Write outbox entry (same DB — MongoDB)
        try {
            const outboxEntry = new OutboxEntry({
                event_id: data.event_id,
                payload: {
                    tenant_id: data.tenant_id,
                    service: data.service,
                    environment: data.environment,
                    endpoint: data.endpoint,
                    method: data.method,
                    status_code: data.status,
                    latency: Math.round(data.latency),
                    error: data.error ?? null,
                    timestamp: new Date(data.timestamp),
                },
                status: "pending",
            });
            await outboxEntry.save();
            log.debug(`Outbox entry created for event: ${data.event_id}`);
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                log.debug(`Outbox entry already exists for event: ${data.event_id}`);
                return; // Already queued for projection
            }
            throw error;
        }
    }
}

