export type AlertMetric = "error_rate" | "latency" | "request_count";
export type AlertCondition = ">" | "<";
export type AlertSeverity = "critical" | "warning" | "info";

/**
 * Alert rule entity - defines a monitoring alert condition.
 * Scoped per project for multi-project support.
 */
export interface AlertRule {
    id: string;
    project_id: string;
    tenant_id: string;
    name: string;
    metric: AlertMetric;
    condition: AlertCondition;
    threshold: number;
    severity: AlertSeverity;
    window_minutes: number;
    cooldown_minutes: number;
    // When true, an email is sent to the tenant on trigger. Defaults to false.
    send_email: boolean;
    silence_until: Date | null;
    status: "resolved" | "triggered";
    enabled: boolean;
    created_at?: Date;
    updated_at?: Date;
    // Helper property for logic (not in DB)
    triggered?: boolean;
}

/**
 * Alert history entity - a triggered alert event.
 */
export interface AlertHistory {
    id: string;
    rule_id: string;
    rule_name: string;
    project_id: string;
    tenant_id: string;
    metric_value: number;
    severity: AlertSeverity;
    status: "triggered" | "resolved";
    triggered_at: Date;
    resolved_at?: Date;
}
