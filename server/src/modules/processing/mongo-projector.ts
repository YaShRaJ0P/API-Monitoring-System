import RawEvent from "../../models/RawEvent.js";
import type { IngestionType } from "../ingestion/ingestion.validator.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("MongoProjector");

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
 * Projects raw telemetry events into MongoDB for deep-dive logging and querying.
 * Reads from the PostgreSQL outbox.
 *
 * Idempotent: if the same event_id is stored twice, the duplicate is silently skipped.
 */
export class MongoProjector {
    /**
     * Stores a raw event in MongoDB.
     * @param {IngestionType} data - Validated telemetry payload
     * @returns {Promise<void>}
     */
    async project(data: IngestionType): Promise<void> {

        try {
            const rawEvent = new RawEvent({
                event_id: data.event_id,
                tenant_id: data.tenant_id,
                project_id: data.project_id,
                endpoint: data.endpoint,
                method: data.method,
                status: data.status,
                latency: data.latency,
                timestamp: new Date(data.timestamp ?? new Date().toISOString()),
                environment: data.environment,
                service: data.service,
                error: data.error,
            });
            await rawEvent.save();
            log.info(`Raw event projected to MongoDB: ${data.event_id}`);
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                log.info(`Duplicate event skipped (already projected): ${data.event_id}`);
                return; // Idempotent - successfully completed in context of outbox
            }
            throw error;
        }
    }
}
