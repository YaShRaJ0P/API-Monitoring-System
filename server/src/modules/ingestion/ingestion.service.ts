import type { IngestionType } from "./ingestion.validator.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { Circuit } from "../../config/circuit.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("IngestionService");

/**
 * Represents the result of a fire() call, which can either be
 * a direct boolean from publishTelemetry or the fallback object.
 */
interface FallbackResult {
    success: boolean;
    buffered: boolean;
}

/**
 * Orchestrates the ingestion of telemetry data through the circuit breaker.
 * Receives its Circuit dependency via constructor injection.
 */
export class IngestionService {
    constructor(private readonly circuit: Circuit) { }

    /**
     * Ingests telemetry data through the circuit breaker.
     * @param {IngestionType} data - Validated telemetry payload
     * @returns {{ published: boolean, buffered: boolean }} Ingestion result
     */
    ingestData = async (data: IngestionType): Promise<{ published: boolean; buffered: boolean }> => {
        try {
            const result = await this.circuit.fire(data);

            // Distinguish between direct publish success and fallback-buffered scenario
            if (typeof result === 'object' && result !== null && (result as FallbackResult).buffered) {
                log.warn(`Telemetry buffered to Redis (circuit open): ${data.event_id}`);
                return { published: false, buffered: true };
            }

            if (!result) {
                throw new AppError(500, "Failed to publish telemetry");
            }

            log.debug(`Telemetry published: ${data.event_id}`);
            return { published: true, buffered: false };
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to ingest data");
        }
    }
}