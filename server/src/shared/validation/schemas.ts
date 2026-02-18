import { z } from "zod";

/**
 * Zod schemas for request body validation across API endpoints.
 * Used by the validate middleware to enforce data contracts.
 */

// ─── Alert Rules ───

export const createAlertRuleSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    metric: z.enum(["error_rate", "latency", "request_count"]),
    condition: z.enum([">", "<"]),
    threshold: z.number().positive("Threshold must be positive"),
    severity: z.enum(["critical", "warning", "info"]).default("warning"),
    window_minutes: z.number().int().min(1).max(1440).default(5),
    cooldown_minutes: z.number().int().min(1).max(1440).default(60),
    enabled: z.boolean().default(true),
});

export const updateAlertRuleSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    metric: z.enum(["error_rate", "latency", "request_count"]).optional(),
    condition: z.enum([">", "<"]).optional(),
    threshold: z.number().positive().optional(),
    severity: z.enum(["critical", "warning", "info"]).optional(),
    window_minutes: z.number().int().min(1).max(1440).optional(),
    cooldown_minutes: z.number().int().min(1).max(1440).optional(),
    enabled: z.boolean().optional(),
});

// ─── Ingestion ───

export const ingestEventSchema = z.object({
    service: z.string().min(1, "Service name is required").max(100),
    endpoint: z.string().min(1, "Endpoint is required").max(500),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
    status_code: z.number().int().min(100).max(599),
    latency: z.number().min(0, "Latency must be non-negative"),
    timestamp: z.string().optional(),
    error: z.string().max(2000).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
