import { z } from "zod";

export const IngestionSchema = z.object({
    event_id: z.uuidv4("Event ID is required"),

    tenant_id: z.uuidv4("Tenant ID is required"),

    endpoint: z
        .string("Endpoint is required"),

    method: z
        .string("Method is required")
        .min(1, "Method cannot be empty"),

    status: z
        .number("Status is required")
        .int("Status must be an integer")
        .min(100, "Invalid HTTP status")
        .max(599, "Invalid HTTP status"),

    latency: z
        .number("Latency is required")
        .nonnegative("Latency must be 0 or greater"),

    timestamp: z
        .string("Timestamp is required")
        .datetime("Timestamp must be a valid ISO datetime"),

    environment: z
        .string("Environment is required")
        .min(1, "Environment cannot be empty"),

    service: z
        .string("Service is required")
        .min(1, "Service cannot be empty"),

    error: z
        .string()
        .min(1, "Error cannot be empty")
        .nullable()
        .optional(),
}).strict();

export type IngestionType = z.infer<typeof IngestionSchema>;

export const validateIngestion = (data: unknown) => {
    return IngestionSchema.safeParse(data);
};
