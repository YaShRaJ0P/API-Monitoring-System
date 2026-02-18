export type AlertMetric = "error_rate" | "latency" | "request_count";
export type AlertCondition = ">" | "<";
export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertRule {
    id: string;
    tenant_id: string;
    name: string;
    metric: AlertMetric;
    condition: AlertCondition;
    threshold: number;
    severity: AlertSeverity;
    window_minutes: number;
    cooldown_minutes: number;
    silence_until: Date | null;
    enabled: boolean;
    created_at?: Date;
    updated_at?: Date;
    // Helper property for logic (not in DB)
    triggered?: boolean;
}

export interface AlertHistory {
    id: string;
    rule_id: string;
    rule_name: string;
    tenant_id: string;
    metric_value: number;
    severity: AlertSeverity;
    triggered_at: Date;
}
