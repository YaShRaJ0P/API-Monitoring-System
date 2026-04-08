/**
 * Time Bucket Utilities
 *
 * Provides functions for bucketing timestamps into time intervals
 * for metric aggregation in the API monitoring system.
 *
 */

export type BucketGranularity = "1m" | "5m" | "15m" | "1h" | "1d";

const GRANULARITY_MS: Record<BucketGranularity, number> = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
};

/**
 * Floors a timestamp to the nearest bucket boundary.
 *
 * @param timestamp - A Date object or ISO string
 * @param granularity - The bucket size (e.g. "1m", "5m", "1h", "1d")
 * @returns A new Date representing the start of the bucket
 *
 * @example
 * toBucket(new Date("2026-02-16T01:23:45Z"), "5m")
 * // → Date("2026-02-16T01:20:00Z")
 */
export function toBucket(timestamp: Date | string, granularity: BucketGranularity): Date {
    const ms = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp.getTime();
    const intervalMs = GRANULARITY_MS[granularity];
    const bucketMs = Math.floor(ms / intervalMs) * intervalMs;
    return new Date(bucketMs);
}

/**
 * Generates an array of bucket start times between two dates.
 * Useful for filling gaps in time-series data.
 *
 * @param start - Start of the range
 * @param end - End of the range
 * @param granularity - The bucket size
 * @returns Array of Date objects for each bucket start
 */
export function generateBuckets(start: Date, end: Date, granularity: BucketGranularity): Date[] {
    const intervalMs = GRANULARITY_MS[granularity];
    const buckets: Date[] = [];

    let current = toBucket(start, granularity).getTime();
    const endMs = end.getTime();

    while (current <= endMs) {
        buckets.push(new Date(current));
        current += intervalMs;
    }

    return buckets;
}

/**
 * Returns the granularity label in milliseconds.
 */
export function granularityToMs(granularity: BucketGranularity): number {
    return GRANULARITY_MS[granularity];
}
