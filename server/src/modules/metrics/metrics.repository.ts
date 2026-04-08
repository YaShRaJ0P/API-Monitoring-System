import type { Pool } from "pg";
import { createLogger } from "../../shared/utils/logger.js";
import RawEvent from "../../models/RawEvent.js";
import type { MetricsQuery } from "./metrics.validator.js";
import { AppError } from "../../shared/errors/AppError.js";

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
    timeCol: string = "hour_bucket"
): { clause: string; values: unknown[] } {

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = startIdx;

    conditions.push(`${timeCol} >= $${idx}`);
    values.push(filters.startDate);
    idx++;

    conditions.push(`${timeCol} <= $${idx}`);
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

// -- Result types ---------------

export interface OverviewResult {
    total_requests: number;
    avg_latency: number;
    error_rate: number;
    max_latency: number;
    p95_latency: number;
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
     * Aggregates data from `hourly_metrics` table.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<OverviewResult>} Aggregated overview
     */
    async getOverview(tenantId: string, projectId: string, filters: MetricsQuery): Promise<OverviewResult> {
        const { clause, values } = buildWhereClause(filters, 3);


        const query = `
            SELECT
            COALESCE(SUM(total_requests), 0)::int AS total_requests,
            COALESCE(ROUND(SUM(total_latency) / NULLIF(SUM(total_requests), 0)), 0)::int AS avg_latency,
            COALESCE(ROUND(100.0 * SUM(failure_count) / NULLIF(SUM(total_requests), 0), 2), 0)::float AS error_rate,
            COALESCE(MAX(max_latency), 0)::int AS max_latency,
            COALESCE(SUM(success_count), 0)::int AS success_count,
            COALESCE(SUM(failure_count), 0)::int AS error_count,
            COALESCE(
                percentile_cont(0.95) WITHIN GROUP (ORDER BY total_latency / NULLIF(total_requests,0)),
                0
            )::int AS p95_latency
        FROM hourly_metrics
        WHERE project_id = $1
          AND tenant_id = $2
          AND ${clause};

        `;

        const result = await this.pool.query<OverviewResult>(query, [projectId, tenantId, ...values]);

        return result.rows[0]!;
    }

    /**
     * Returns time-bucketed request counts and latency for charting.
     * Uses `hourly_metrics` regardless of requested granularity for simplicity in this iteration.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @param {MetricsQuery} filters - Validated query parameters (includes granularity)
     * @returns {Promise<TimeseriesBucket[]>} Array of time buckets
     */
    async getTimeseries(
        tenantId: string,
        projectId: string,
        filters: MetricsQuery
    ): Promise<TimeseriesBucket[]> {

        const gran = filters.granularity || "1h";

        // 🔥 1. Parse
        const { value, unit } = this.parseGranularity(gran);

        this.validateGranularityRange(filters, value, unit);

        // 🔥 2. Resolve table
        const { table, column } = this.resolveStorage(unit, value);

        // 🔥 3. Build bucket expression
        const bucketExpr = this.buildBucketExpr(column, value, unit);

        const { clause, values } = buildWhereClause(filters, 3, column);

        const query = `
        SELECT
            ${bucketExpr} AS bucket,
            SUM(total_requests)::int AS request_count,
            COALESCE(
                ROUND(SUM(total_latency) / NULLIF(SUM(total_requests), 0)),
                0
            )::int AS avg_latency,
            SUM(failure_count)::int AS error_count
        FROM ${table}
        WHERE project_id = $1 
          AND tenant_id = $2 
          AND ${clause}
        GROUP BY 1
        ORDER BY 1 ASC
    `;

        const result = await this.pool.query<TimeseriesBucket>(
            query,
            [projectId, tenantId, ...values]
        );

        return result.rows;
    }

    /**
     * Returns per-endpoint performance breakdown.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<EndpointStat[]>} Endpoint stats
     */
    async getEndpointStats(tenantId: string, projectId: string, filters: MetricsQuery): Promise<EndpointStat[]> {
        const { clause, values } = buildWhereClause(filters, 3);

        const query = `
        SELECT
            endpoint,
            method,
            SUM(total_requests)::int AS total_requests,
            COALESCE(
                ROUND(SUM(total_latency) / NULLIF(SUM(total_requests), 0)),
                0
            )::int AS avg_latency,
            COALESCE(
                ROUND(100.0 * SUM(failure_count) / NULLIF(SUM(total_requests), 0), 2),
                0
            )::float AS error_rate,
            COALESCE(
                percentile_cont(0.95) WITHIN GROUP (ORDER BY total_latency / NULLIF(total_requests,0)),
                0
            )::int AS p95_latency
        FROM hourly_metrics
        WHERE project_id = $1 AND tenant_id = $2 AND ${clause}
        GROUP BY endpoint, method
        ORDER BY total_requests DESC;
    `;

        const result = await this.pool.query<EndpointStat>(query, [projectId, tenantId, ...values]);
        return result.rows;
    }

    /**
     * Returns per-service summary.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<ServiceStat[]>} Service stats
     */
    async getServiceStats(tenantId: string, projectId: string, filters: MetricsQuery): Promise<ServiceStat[]> {
        const { clause, values } = buildWhereClause(filters, 3);

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
            WHERE project_id = $1 AND tenant_id = $2 AND ${clause}
            GROUP BY service
            ORDER BY total_requests DESC
        `;

        const result = await this.pool.query<ServiceStat>(query, [projectId, tenantId, ...values]);
        return result.rows;
    }

    /**
     * Returns paginated raw metric logs from MongoDB.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @param {MetricsQuery} filters - Validated query parameters (includes page/limit)
     * @returns {Promise<{ data: MetricLog[], total: number }>} Paginated results
     */
    async getLogs(
        tenantId: string,
        projectId: string,
        filters: MetricsQuery,
    ): Promise<{ data: MetricLog[]; total: number }> {
        const query: any = {
            tenant_id: tenantId,
            project_id: projectId,
            timestamp: { $gte: new Date(filters.startDate), $lte: new Date(filters.endDate) },
        };

        if (filters.service) query.service = filters.service;
        if (filters.environment) query.environment = filters.environment;
        if (filters.endpoint) query.endpoint = { $regex: filters.endpoint, $options: "i" };
        if (filters.errorOnly) query.status = { $gte: 400 };
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
            status_code: e.status,
            latency: e.latency,
            error: e.error || null,
            timestamp: e.timestamp.toISOString(),
        }));

        return { data, total };
    }


    private validateGranularityRange(filters: MetricsQuery, value: number, unit: 'm' | 'h' | 'd' | 'w' | 'y') {
        const rangeMs =
            new Date(filters.endDate).getTime() -
            new Date(filters.startDate).getTime();

        if (rangeMs <= 0) {
            throw new AppError(400, "Invalid time range");
        }

        const maxPoints = 1000; // safe limit

        const unitToMs: Record<'m' | 'h' | 'd' | 'w' | 'y', number> = {
            m: 60_000,
            h: 3_600_000,
            d: 86_400_000,
            w: 604_800_000,
            y: 31_536_000_000
        };

        const bucketMs = value * unitToMs[unit];
        const points = rangeMs / bucketMs;

        if (points > maxPoints) {
            throw new AppError(
                400,
                `Reduce time range.`
            );
        }
    }

    /**
     * Maps granularity string to minute divisor for date_trunc bucketing.
     * @param {string} gran - Granularity string (e.g., "1m", "1h", "1d", "1w", "1y")
     * @returns {{ value: number, unit: string }} Minute interval
     */
    private parseGranularity(gran: string): { value: number, unit: 'm' | 'h' | 'd' | 'w' | 'y' } {
        const match = gran.match(/^(\d+)([mhdwy])$/);
        if (!match) throw new AppError(400, "Invalid granularity");

        return {
            value: parseInt(match[1] as string, 10),
            unit: match[2] as 'm' | 'h' | 'd' | 'w' | 'y'
        };
    }

    /**
     * Resolves the storage table and column based on the granularity unit.
     * @param {string} unit - Granularity unit (m, h, d, w, y)
     * @returns {{ table: string, column: string }} Storage table and column
     */
    private resolveStorage(unit: string, value: number) {
        // Use minute table for anything < 1h precision
        if (unit === 'm') {
            return {
                table: "minute_metrics",
                column: "minute_bucket"
            };
        }

        return {
            table: "hourly_metrics",
            column: "hour_bucket"
        };
    }

    /**
     * Builds the bucket expression for date_trunc bucketing.
     * @param {string} column - Column name
     * @param {number} value - Bucket value
     * @param {string} unit - Granularity unit (m, h, d, w, y)
     * @returns {string} Bucket expression
     */
    private buildBucketExpr(column: string, value: number, unit: string): string {
        const unitToSeconds: Record<string, number> = {
            m: 60,
            h: 3600,
            d: 86400,
            w: 604800,
            y: 31536000
        };

        const seconds = unitToSeconds[unit];
        if (!seconds) {
            throw new AppError(400, "Invalid granularity unit");
        }

        const bucketSize = value * seconds;

        return `
        to_timestamp(
            floor(extract(epoch from ${column}) / ${bucketSize}) * ${bucketSize}
        )
    `;
    }
}
