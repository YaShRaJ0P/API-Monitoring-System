import type { Pool } from "pg";
import { createLogger } from "../../shared/utils/logger.js";
import { toBucket } from "../../shared/utils/timebucket.js";

const log = createLogger("MetricsProjector");

/**
 * Query-side of CQRS: projects telemetry data into PostgreSQL
 * for analytics and dashboard queries.
 *
 * Receives its PostgreSQL Pool via constructor injection.
 */
export class MetricsProjector {
    constructor(private readonly pool: Pool) { }

    /**
     * Projects a single outbox payload into aggregated metrics tables.
     * Performs UPSERT operations on both minute_metrics and hourly_metrics.
     * @param {Record<string, unknown>} payload - Outbox entry payload
     * @returns {Promise<void>}
     */
    async project(payload: Record<string, unknown>): Promise<void> {
        const timestamp = new Date(payload.timestamp as string);
        const minuteBucket = toBucket(timestamp, "1m");
        const hourBucket = toBucket(timestamp, "1h");

        const isSuccess = (payload.status_code as number) < 400 ? 1 : 0;
        const isFailure = (payload.status_code as number) >= 400 ? 1 : 0;
        const latency = payload.latency as number;

        const client = await this.pool.connect();

        try {
            await client.query("BEGIN");

            // 1. UPSERT minute_metrics
            await client.query(
                `INSERT INTO minute_metrics (
                    tenant_id, service, environment, endpoint, method, minute_bucket,
                    total_requests, success_count, failure_count, total_latency,
                    min_latency, max_latency
                ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $9, $9)
                ON CONFLICT (tenant_id, service, environment, endpoint, method, minute_bucket)
                DO UPDATE SET
                    total_requests = minute_metrics.total_requests + 1,
                    success_count = minute_metrics.success_count + $7,
                    failure_count = minute_metrics.failure_count + $8,
                    total_latency = minute_metrics.total_latency + $9,
                    min_latency = LEAST(minute_metrics.min_latency, EXCLUDED.min_latency),
                    max_latency = GREATEST(minute_metrics.max_latency, EXCLUDED.max_latency)`,
                [
                    payload.tenant_id, payload.service, payload.environment, payload.endpoint, payload.method,
                    minuteBucket, isSuccess, isFailure, latency
                ]
            );

            // 2. UPSERT hourly_metrics
            await client.query(
                `INSERT INTO hourly_metrics (
                    tenant_id, service, environment, endpoint, method, hour_bucket,
                    total_requests, success_count, failure_count, total_latency,
                    min_latency, max_latency
                ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $9, $9)
                ON CONFLICT (tenant_id, service, environment, endpoint, method, hour_bucket)
                DO UPDATE SET
                    total_requests = hourly_metrics.total_requests + 1,
                    success_count = hourly_metrics.success_count + $7,
                    failure_count = hourly_metrics.failure_count + $8,
                    total_latency = hourly_metrics.total_latency + $9,
                    min_latency = LEAST(hourly_metrics.min_latency, EXCLUDED.min_latency),
                    max_latency = GREATEST(hourly_metrics.max_latency, EXCLUDED.max_latency)`,
                [
                    payload.tenant_id, payload.service, payload.environment, payload.endpoint, payload.method,
                    hourBucket, isSuccess, isFailure, latency
                ]
            );

            await client.query("COMMIT");
            log.debug(`Metrics projected (minute+hour) for tenant: ${payload.tenant_id}`);
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }
}
