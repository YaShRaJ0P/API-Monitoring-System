import type { Pool } from "pg";
import { createLogger } from "../../shared/utils/logger.js";
import { toBucket } from "../../shared/utils/timebucket.js";
import type { IngestionType } from "../ingestion/ingestion.validator.js";

const log = createLogger("MetricsStore");

/**
 * Projects telemetry data into PostgreSQL for analytics and dashboard queries.
 * Writes an outbox entry in the SAME transaction for eventual consistency to MongoDB.
 */
export class MetricsStore {
    constructor(private readonly pool: Pool) { }

    /**
     * Projects a single telemetry payload into aggregated metrics tables
     * and inserts an outbox entry atomically.
     * @param {IngestionType} data - Telemetry payload
     * @returns {Promise<void>}
     */
    async store(data: IngestionType): Promise<void> {
        const timestamp = new Date(data.timestamp ?? new Date().toISOString());
        const minuteBucket = toBucket(timestamp, "1m");
        const hourBucket = toBucket(timestamp, "1h");

        const isSuccess = data.status < 400 ? 1 : 0;
        const isFailure = data.status >= 400 ? 1 : 0;
        const latency = data.latency;

        const client = await this.pool.connect();

        try {
            await client.query("BEGIN");

            // 1. UPSERT minute_metrics
            await client.query(
                `INSERT INTO minute_metrics (
                    project_id, tenant_id, service, environment, endpoint, method, minute_bucket,
                    total_requests, success_count, failure_count, total_latency,
                    min_latency, max_latency
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10, $10, $10)
                ON CONFLICT (project_id, service, environment, endpoint, method, minute_bucket)
                DO UPDATE SET
                    total_requests = minute_metrics.total_requests + 1,
                    success_count = minute_metrics.success_count + $8,
                    failure_count = minute_metrics.failure_count + $9,
                    total_latency = minute_metrics.total_latency + $10,
                    min_latency = LEAST(minute_metrics.min_latency, EXCLUDED.min_latency),
                    max_latency = GREATEST(minute_metrics.max_latency, EXCLUDED.max_latency)`,
                [
                    data.project_id, data.tenant_id, data.service, data.environment,
                    data.endpoint, data.method, minuteBucket,
                    isSuccess, isFailure, latency
                ]
            );

            // 2. UPSERT hourly_metrics
            await client.query(
                `INSERT INTO hourly_metrics (
                    project_id, tenant_id, service, environment, endpoint, method, hour_bucket,
                    total_requests, success_count, failure_count, total_latency,
                    min_latency, max_latency
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10, $10, $10)
                ON CONFLICT (project_id, service, environment, endpoint, method, hour_bucket)
                DO UPDATE SET
                    total_requests = hourly_metrics.total_requests + 1,
                    success_count = hourly_metrics.success_count + $8,
                    failure_count = hourly_metrics.failure_count + $9,
                    total_latency = hourly_metrics.total_latency + $10,
                    min_latency = LEAST(hourly_metrics.min_latency, EXCLUDED.min_latency),
                    max_latency = GREATEST(hourly_metrics.max_latency, EXCLUDED.max_latency)`,
                [
                    data.project_id, data.tenant_id, data.service, data.environment,
                    data.endpoint, data.method, hourBucket,
                    isSuccess, isFailure, latency
                ]
            );

            // 3. INSERT outbox_entry (for MongoDB RawEvents)
            // Storing the full raw payload so the outbox processor can build a Mongo doc
            const payloadJson = JSON.stringify(data);
            await client.query(
                `INSERT INTO outbox_entries (event_id, payload, status)
                 VALUES ($1, $2, 'pending')
                 ON CONFLICT (event_id) DO NOTHING`,
                [data.event_id, payloadJson]
            );

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }
}
