import { z } from "zod";

const granularityEnum = z.enum(["1m", "5m", "15m", "1h", "1d"]);

/**
 * Shared query-parameter schema for all metrics endpoints.
 * Validates date range, optional filters, and pagination.
 */
export const MetricsQuerySchema = z.object({
    startDate: z
        .string()
        .datetime("startDate must be a valid ISO datetime"),

    endDate: z
        .string()
        .datetime("endDate must be a valid ISO datetime"),

    service: z.string().optional(),
    environment: z.string().optional(),
    endpoint: z.string().optional(),
    method: z.string().optional(),

    granularity: granularityEnum.optional().default("1h"),

    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type MetricsQuery = z.infer<typeof MetricsQuerySchema>;

/**
 * Validates incoming metrics query parameters.
 * @param {unknown} data - Raw query params object
 * @returns {z.SafeParseReturnType} Parsed result or validation errors
 */
export const validateMetricsQuery = (data: unknown) => {
    return MetricsQuerySchema.safeParse(data);
};
