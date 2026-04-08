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
 * All queries are scoped by project_id.
 */
export class MetricsService {
    constructor(private readonly metricsRepo: MetricsRepository) { }

    /**
     * Returns dashboard overview stats for a project.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<OverviewResult>} Aggregated overview
     */
    async getOverview(tenantId: string, projectId: string, filters: MetricsQuery): Promise<OverviewResult> {
        return this.metricsRepo.getOverview(tenantId, projectId, filters);
    }

    /**
     * Returns gap-filled time-series data for charting.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<TimeseriesBucket[]>} Complete time-series with no gaps
     */
    async getTimeseries(tenantId: string, projectId: string, filters: MetricsQuery): Promise<TimeseriesBucket[]> {
        const rawBuckets = await this.metricsRepo.getTimeseries(tenantId, projectId, filters);

        const bucketMap = new Map<string, TimeseriesBucket>();
        for (const row of rawBuckets) {
            bucketMap.set(new Date(row.bucket).toISOString(), row);
        }

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

        return filled;
    }

    /**
     * Returns per-endpoint performance breakdown.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<EndpointStat[]>} Endpoint stats
     */
    async getEndpointStats(tenantId: string, projectId: string, filters: MetricsQuery): Promise<EndpointStat[]> {
        return this.metricsRepo.getEndpointStats(tenantId, projectId, filters);
    }

    /**
     * Returns per-service summary.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<ServiceStat[]>} Service stats
     */
    async getServiceStats(tenantId: string, projectId: string, filters: MetricsQuery): Promise<ServiceStat[]> {
        return this.metricsRepo.getServiceStats(tenantId, projectId, filters);
    }

    /**
     * Returns paginated raw metric logs.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @param {MetricsQuery} filters - Validated query parameters
     * @returns {Promise<{ data: MetricLog[], total: number, page: number, limit: number }>}
     */
    async getLogs(
        tenantId: string,
        projectId: string,
        filters: MetricsQuery,
    ): Promise<{ data: MetricLog[]; total: number; page: number; limit: number }> {
        const result = await this.metricsRepo.getLogs(tenantId, projectId, filters);
        return {
            ...result,
            page: filters.page,
            limit: filters.limit,
        };
    }
}
