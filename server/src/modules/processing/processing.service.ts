import type { MetricsStore } from "./metrics-store.js";
import type { IngestionType } from "../ingestion/ingestion.validator.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("ProcessingService");

export class ProcessingService {
    constructor(private readonly metricsStore: MetricsStore) { }

    /**
     * Processes a validated telemetry event by storing it
     * @param {IngestionType} data - Validated telemetry payload
     * @returns {Promise<boolean>} True if stored successfully
     */
    async processTelemetry(data: IngestionType): Promise<boolean> {
        await this.metricsStore.store(data);

        return true;
    }
}
