import type {
    MetricsRepository,
    OverviewResult,
    TimeseriesBucket,
    EndpointStat,
    ServiceStat,
    MetricLog,
} from "./metrics.repository.js";
import type { MetricsQuery } from "./metrics.validator.js";
import { generateBuckets } from "../../shared/utils/timebucket.js";
import type { BucketGranularity } from "../../shared/utils/timebucket.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("MetricsService");

/**
 * Service layer for metrics read operations.
 * Delegates to MetricsRepository and enriches timeseries with gap-filled buckets.
 */
export class MetricsService {
    constructor(private readonly metricsRepo: MetricsRepository) { }

    /**
     * Returns dashboard overview stats for a tenant.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<OverviewResult>} Aggregated overview
     */
    async getOverview(tenantId: string, filters: MetricsQuery): Promise<OverviewResult> {
        return this.metricsRepo.getOverview(tenantId, filters);
    }

    /**
     * Returns gap-filled time-series data for charting.
     * Missing buckets are filled with zero values so charts render continuously.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<TimeseriesBucket[]>} Complete time-series with no gaps
     */
    async getTimeseries(tenantId: string, filters: MetricsQuery): Promise<TimeseriesBucket[]> {
        const rawBuckets = await this.metricsRepo.getTimeseries(tenantId, filters);

        // Build a lookup from the DB results
        const bucketMap = new Map<string, TimeseriesBucket>();
        for (const row of rawBuckets) {
            bucketMap.set(new Date(row.bucket).toISOString(), row);
        }

        // Generate all expected buckets and fill gaps
        const allBuckets = generateBuckets(
            new Date(filters.startDate),
            new Date(filters.endDate),
            filters.granularity as BucketGranularity,
        );

        const filled: TimeseriesBucket[] = allBuckets.map((bucketDate) => {
            const key = bucketDate.toISOString();
            return bucketMap.get(key) ?? {
                bucket: key,
                request_count: 0,
                avg_latency: 0,
                error_count: 0,
            };
        });

        log.debug("Timeseries gap-filled", { tenantId, total: filled.length });
        return filled;
    }

    /**
     * Returns per-endpoint performance breakdown.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<EndpointStat[]>} Endpoint stats
     */
    async getEndpointStats(tenantId: string, filters: MetricsQuery): Promise<EndpointStat[]> {
        return this.metricsRepo.getEndpointStats(tenantId, filters);
    }

    /**
     * Returns per-service summary.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<ServiceStat[]>} Service stats
     */
    async getServiceStats(tenantId: string, filters: MetricsQuery): Promise<ServiceStat[]> {
        return this.metricsRepo.getServiceStats(tenantId, filters);
    }

    /**
     * Returns paginated raw metric logs.
     * @param {string} tenantId - Tenant UUID
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<{ data: MetricLog[], total: number, page: number, limit: number }>}
     */
    async getLogs(
        tenantId: string,
        filters: MetricsQuery,
    ): Promise<{ data: MetricLog[]; total: number; page: number; limit: number }> {
        const result = await this.metricsRepo.getLogs(tenantId, filters);
        return {
            ...result,
            page: filters.page,
            limit: filters.limit,
        };
    }
}
