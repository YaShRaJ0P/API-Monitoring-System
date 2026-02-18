import { AlertsRepository } from "./alerts.repository.js";
import type { AlertRule } from "./alerts.model.js";
import { PostgreSQL } from "../../config/db/postgres.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("AlertsService");

export class AlertsService {
    constructor(private readonly alertsRepo: AlertsRepository) { }

    // ── User Facing ──

    async createRule(rule: Partial<AlertRule>) {
        return this.alertsRepo.createRule(rule);
    }

    async getRules(tenantId: string) {
        return this.alertsRepo.getRules(tenantId);
    }

    async updateRule(id: string, tenantId: string, updates: Partial<AlertRule>) {
        return this.alertsRepo.updateRule(id, tenantId, updates);
    }

    async deleteRule(id: string, tenantId: string) {
        return this.alertsRepo.deleteRule(id, tenantId);
    }

    async getAlertHistory(tenantId: string, page: number, limit: number) {
        return this.alertsRepo.getAlertHistory(tenantId, page, limit);
    }

    // ── System / Job Logic ──

    /**
     * Evaluates all enabled rules against current metrics.
     * This is called by the background job.
     */
    async evaluateRules() {
        const rules = await this.alertsRepo.getAllEnabledRules();
        if (rules.length === 0) return;

        const pool = PostgreSQL.getPool();

        for (const rule of rules) {
            try {
                // Skip silenced rules
                if (rule.silence_until && new Date(rule.silence_until) > new Date()) {
                    continue;
                }

                // Calculate metric value for the last N minutes
                const metricValue = await this.calculateMetric(pool, rule);

                // Check condition
                const triggered = this.checkCondition(metricValue, rule);

                if (triggered) {
                    await this.triggerAlert(rule, metricValue);
                }
            } catch (error) {
                log.error(`Failed to evaluate rule ${rule.id}`, undefined, error instanceof Error ? error : undefined);
            }
        }
    }

    private async calculateMetric(pool: any, rule: AlertRule): Promise<number> {
        const windowMinutes = rule.window_minutes || 5;

        let query = "";

        if (rule.metric === "error_rate") {
            // (Sum(failures) / Sum(total)) * 100
            query = `
                SELECT 
                    COALESCE(
                        ROUND(100.0 * SUM(failure_count) / NULLIF(SUM(total_requests), 0), 2),
                        0
                    )::float as val
                FROM minute_metrics
                WHERE tenant_id = $1 
                  AND minute_bucket >= NOW() - make_interval(mins => $2)
            `;
        } else if (rule.metric === "latency") {
            // Avg latency
            query = `
                SELECT 
                    COALESCE(
                        ROUND(SUM(total_latency) / NULLIF(SUM(total_requests), 0)), 
                        0
                    )::float as val
                FROM minute_metrics
                WHERE tenant_id = $1 
                  AND minute_bucket >= NOW() - make_interval(mins => $2)
            `;
        } else if (rule.metric === "request_count") {
            // Total requests
            query = `
                SELECT COALESCE(SUM(total_requests), 0)::float as val
                FROM minute_metrics
                WHERE tenant_id = $1 
                  AND minute_bucket >= NOW() - make_interval(mins => $2)
            `;
        } else {
            return 0;
        }

        const result = await pool.query(query, [rule.tenant_id, windowMinutes]);
        return result.rows[0]?.val ?? 0;
    }

    private checkCondition(value: number, rule: AlertRule): boolean {
        if (rule.condition === ">") return value > rule.threshold;
        if (rule.condition === "<") return value < rule.threshold;
        return false;
    }

    private async triggerAlert(rule: AlertRule, value: number) {
        log.warn(`🚨 ALERT TRIGGERED: Rule '${rule.name}' (ID: ${rule.id}) - Value: ${value} (Threshold: ${rule.threshold})`);

        // 1. Record History
        await this.alertsRepo.recordAlertHistory({
            rule_id: rule.id,
            tenant_id: rule.tenant_id,
            metric_value: value,
            severity: rule.severity || "warning",
        });

        // 2. Silence Rule (Cooldown)
        const silenceUntil = new Date(Date.now() + (rule.cooldown_minutes * 60 * 1000));
        await this.alertsRepo.silenceRule(rule.id, silenceUntil);

        // 3. Send Notification (Placeholder for now - just log)
        // In future: EmailService.sendAlert(...)
    }
}
