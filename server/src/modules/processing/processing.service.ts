import type { EventStore } from "./event-store.js";
import type { IngestionType } from "../ingestion/ingestion.validator.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("ProcessingService");

/**
 * Orchestrates telemetry processing through the CQRS command side.
 * Delegates to EventStore for MongoDB writes (raw event + outbox).
 *
 * No direct PostgreSQL access — metrics projection is handled
 * by the OutboxProcessor + MetricsProjector pipeline.
 */
export class ProcessingService {
    constructor(private readonly eventStore: EventStore) { }

    /**
     * Processes a validated telemetry event by storing it
     * in the event store (MongoDB) with an outbox entry.
     * @param {IngestionType} data - Validated telemetry payload
     * @returns {Promise<boolean>} True if stored successfully
     */
    async processTelemetry(data: IngestionType): Promise<boolean> {
        log.debug(`Processing telemetry event: ${data.event_id}`, { tenantId: data.tenant_id });

        await this.eventStore.store(data);

        return true;
    }
}
