export const QUEUES = {
    TELEMETRY: "api_hits",
    RETRY: "api_hits_retry",
    DLQ: "api_hits_dlq"
};

export const EXCHANGES = {
    TELEMETRY: "telemetry_exchange"
};

export const ROUTING_KEYS = {
    TELEMETRY: "telemetry.event",
    TELEMETRY_RETRY: "telemetry.retry"
};
