import type { Pool } from "pg";
import { createLogger } from "../../shared/utils/logger.js";
import RawEvent from "../../models/RawEvent.js";
import type { MetricsQuery } from "./metrics.validator.js";

const log = createLogger("MetricsRepository");

/**
 * Builds a parameterised WHERE clause from shared metric filters.
 * @param {MetricsQuery} filters - Validated query parameters
 * @param {number} startIdx - Parameter index offset (for $N placeholders)
 * @returns {{ clause: string, values: unknown[] }} SQL fragment + bind values
 */
function buildWhereClause(
    filters: MetricsQuery,
    startIdx: number,
): { clause: string; values: unknown[] } {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = startIdx;

    conditions.push(`tenant_id = $${idx}`);
    // tenant_id is added by the caller — starting placeholder
    idx++;

    conditions.push(`hour_bucket >= $${idx}`);
    values.push(filters.startDate);
    idx++;

    conditions.push(`hour_bucket <= $${idx}`);
    values.push(filters.endDate);
    idx++;

    if (filters.service) {
        conditions.push(`service = $${idx}`);
        values.push(filters.service);
        idx++;
    }

    if (filters.environment) {
        conditions.push(`environment = $${idx}`);
        values.push(filters.environment);
        idx++;
    }

    if (filters.endpoint) {
        conditions.push(`endpoint = $${idx}`);
        values.push(filters.endpoint);
        idx++;
    }

    if (filters.method) {
        conditions.push(`method = $${idx}`);
        values.push(filters.method);
        idx++;
    }

    return {
        clause: conditions.join(" AND "),
        values,
    };
}

// ── Result types ────────────────────────────────────────────────────

export interface OverviewResult {
    total_requests: number;
    avg_latency: number;
    error_rate: number;
    p95_latency: number;
    p99_latency: number;
    success_count: number;
    error_count: number;
}

export interface TimeseriesBucket {
    bucket: string;
    request_count: number;
    avg_latency: number;
    error_count: number;
}

export interface EndpointStat {
    endpoint: string;
    method: string;
    total_requests: number;
    avg_latency: number;
    error_rate: number;
    p95_latency: number;
}

export interface ServiceStat {
    service: string;
    total_requests: number;
    avg_latency: number;
    error_rate: number;
}

export interface MetricLog {
    id: string;
    service: string;
    environment: string;
    endpoint: string;
    method: string;
    status_code: number;
    latency: number;
    error: string | null;
    timestamp: string;
}

/**
 * Repository for metrics read queries against PostgreSQL.
 * Receives its Pool via constructor injection.
 */
export class MetricsRepository {
    constructor(private readonly pool: Pool) { }

    /**
     * Returns high-level dashboard overview stats.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<OverviewResult>} Aggregated overview
     */
    /**
     * Returns high-level dashboard overview stats.
     * Aggregates data from `hourly_metrics` table.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<OverviewResult>} Aggregated overview
     */
    async getOverview(tenantId: string, filters: MetricsQuery): Promise<OverviewResult> {
        const { clause, values } = buildWhereClause(filters, 2);

        const query = `
            SELECT
                COALESCE(SUM(total_requests), 0)::int                   AS total_requests,
                COALESCE(
                    ROUND(SUM(total_latency) / NULLIF(SUM(total_requests), 0)),
                    0
                )::int                                                  AS avg_latency,
                COALESCE(
                    ROUND(100.0 * SUM(failure_count) / NULLIF(SUM(total_requests), 0), 2),
                    0
                )::float                                                AS error_rate,
                0                                                       AS p95_latency, -- Not available in pre-aggregated
                0                                                       AS p99_latency, -- Not available in pre-aggregated
                COALESCE(SUM(success_count), 0)::int                    AS success_count,
                COALESCE(SUM(failure_count), 0)::int                    AS error_count
            FROM hourly_metrics
            WHERE ${clause}
        `;

        const result = await this.pool.query<OverviewResult>(query, [tenantId, ...values]);
        log.debug("Overview query executed", { tenantId });
        return result.rows[0]!;
    }

    /**
     * Returns time-bucketed request counts and latency for charting.
     * Uses `hourly_metrics` regardless of requested granularity for simplicity in this iteration,
     * but queries can be adjusted to use minute_metrics for short ranges if needed.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters (includes granularity)
     * @returns {Promise<TimeseriesBucket[]>} Array of time buckets
     */
    async getTimeseries(tenantId: string, filters: MetricsQuery): Promise<TimeseriesBucket[]> {
        const { clause, values } = buildWhereClause(filters, 2);

        // We use the same granularityLogic to bucket the already-bucketed hourly data if user asks for 1d
        // Note: For <1h granularity, this will return repeated hourly values if we query hourly_metrics.
        // Ideally, we switch table based on granularity. For now, we stick to hourly_metrics as per Week 4 plan (Analytics).

        const query = `
            SELECT
                date_trunc('minute', hour_bucket) -
                    (EXTRACT(MINUTE FROM hour_bucket)::int % ${this.granularityMinutes(filters.granularity)} || ' minutes')::interval
                    AS bucket,
                SUM(total_requests)::int                               AS request_count,
                COALESCE(
                    ROUND(SUM(total_latency) / NULLIF(SUM(total_requests), 0)),
                    0
                )::int                                                 AS avg_latency,
                SUM(failure_count)::int                                AS error_count
            FROM hourly_metrics
            WHERE ${clause}
            GROUP BY bucket
            ORDER BY bucket ASC
        `;

        const result = await this.pool.query<TimeseriesBucket>(query, [tenantId, ...values]);
        log.debug("Timeseries query executed", { tenantId, granularity: filters.granularity });
        return result.rows;
    }

    /**
     * Returns per-endpoint performance breakdown.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<EndpointStat[]>} Endpoint stats
     */
    async getEndpointStats(tenantId: string, filters: MetricsQuery): Promise<EndpointStat[]> {
        const { clause, values } = buildWhereClause(filters, 2);

        const query = `
            SELECT
                endpoint,
                method,
                SUM(total_requests)::int                               AS total_requests,
                COALESCE(
                    ROUND(SUM(total_latency) / NULLIF(SUM(total_requests), 0)),
                    0
                )::int                                                 AS avg_latency,
                COALESCE(
                    ROUND(100.0 * SUM(failure_count) / NULLIF(SUM(total_requests), 0), 2),
                    0
                )::float                                               AS error_rate,
                0                                                      AS p95_latency
            FROM hourly_metrics
            WHERE ${clause}
            GROUP BY endpoint, method
            ORDER BY total_requests DESC
        `;

        const result = await this.pool.query<EndpointStat>(query, [tenantId, ...values]);
        log.debug("Endpoint stats query executed", { tenantId });
        return result.rows;
    }

    /**
     * Returns per-service summary.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<ServiceStat[]>} Service stats
     */
    async getServiceStats(tenantId: string, filters: MetricsQuery): Promise<ServiceStat[]> {
        const { clause, values } = buildWhereClause(filters, 2);

        const query = `
            SELECT
                service,
                SUM(total_requests)::int                               AS total_requests,
                COALESCE(
                    ROUND(SUM(total_latency) / NULLIF(SUM(total_requests), 0)),
                    0
                )::int                                                 AS avg_latency,
                COALESCE(
                    ROUND(100.0 * SUM(failure_count) / NULLIF(SUM(total_requests), 0), 2),
                    0
                )::float                                               AS error_rate
            FROM hourly_metrics
            WHERE ${clause}
            GROUP BY service
            ORDER BY total_requests DESC
        `;

        const result = await this.pool.query<ServiceStat>(query, [tenantId, ...values]);
        log.debug("Service stats query executed", { tenantId });
        return result.rows;
    }

    /**
     * Returns paginated raw metric logs.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters (includes page/limit)
     * @returns {Promise<{ data: MetricLog[], total: number }>} Paginated results
     */
    /**
     * Returns paginated raw metric logs from MongoDB.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters (includes page/limit)
     * @returns {Promise<{ data: MetricLog[], total: number }>} Paginated results
     */
    async getLogs(
        tenantId: string,
        filters: MetricsQuery,
    ): Promise<{ data: MetricLog[]; total: number }> {
        const query: any = {
            tenant_id: tenantId,
            timestamp: { $gte: new Date(filters.startDate), $lte: new Date(filters.endDate) },
        };

        if (filters.service) query.service = filters.service;
        if (filters.environment) query.environment = filters.environment;
        if (filters.endpoint) query.endpoint = filters.endpoint;
        if (filters.method) query.method = filters.method;

        const skip = (filters.page - 1) * filters.limit;

        const [events, total] = await Promise.all([
            RawEvent.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(filters.limit)
                .lean(),
            RawEvent.countDocuments(query),
        ]);

        const data: MetricLog[] = events.map((e) => ({
            id: (e._id as unknown as string).toString(),
            service: e.service,
            environment: e.environment,
            endpoint: e.endpoint,
            method: e.method,
            status_code: e.status, // Model has 'status', interface has 'status_code'
            latency: e.latency,
            error: e.error || null,
            timestamp: e.timestamp.toISOString(),
        }));

        log.debug("Logs query executed (MongoDB)", { tenantId, page: filters.page });
        return { data, total };
    }

    /**
     * Maps granularity string to minute divisor for date_trunc bucketing.
     * @param {string} granularity - Bucket size key
     * @returns {number} Minute interval
     */
    private granularityMinutes(granularity: string): number {
        const map: Record<string, number> = {
            "1m": 1,
            "5m": 5,
            "15m": 15,
            "1h": 60,
            "1d": 1440,
        };
        return map[granularity] || 60;
    }
}
