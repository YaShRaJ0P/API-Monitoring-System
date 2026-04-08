export const QUEUES = {
    TELEMETRY: "api_hits",
    RETRY: "api_hits_retry",
    DLQ: "api_hits_dlq",
    EMAIL_ALERTS: "email_alerts",
};

export const EXCHANGES = {
    TELEMETRY: "telemetry_exchange"
};

export const ROUTING_KEYS = {
    TELEMETRY: "telemetry.event",
    TELEMETRY_RETRY: "telemetry.retry",
    EMAIL_ALERT: "email.alert"
};
