import { AlertsRepository } from "./alerts.repository.js";
import type { AlertRule } from "./alerts.model.js";
import { createLogger } from "../../shared/utils/logger.js";
import { RabbitMQ } from "../../config/rabbitmq.js";
import { QUEUES } from "../../queue/queues.js";

const log = createLogger("AlertsService");

/**
 * Service for alert rule management and background evaluation.
 * User-facing methods are scoped by project_id + tenant_id.
 * System (worker) methods evaluate all rules for a given project.
 */
export class AlertsService {
    constructor(private readonly alertsRepo: AlertsRepository) { }

    // -- User Facing (CRUD) ---------

    /**
     * Creates an alert rule for a project.
     * @param {Partial<AlertRule>} rule - Rule data with project_id and tenant_id
     * @returns {Promise<AlertRule>} Created rule
     */
    async createRule(rule: Partial<AlertRule>) {
        return this.alertsRepo.createRule(rule);
    }

    /**
     * Retrieves all alert rules for a specific project.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @returns {Promise<AlertRule[]>}
     */
    async getRules(tenantId: string, projectId: string): Promise<AlertRule[]> {
        return this.alertsRepo.getRules(tenantId, projectId);
    }

    /**
     * Updates an existing alert rule.
     * @param {string} id - Rule UUID
     * @param {string} tenantId - Tenant UUID (ownership check)
     * @param {Partial<AlertRule>} updates - Fields to update
     */
    async updateRule(id: string, tenantId: string, updates: Partial<AlertRule>) {
        return this.alertsRepo.updateRule(id, tenantId, updates);
    }

    /**
     * Deletes an alert rule.
     * @param {string} id - Rule UUID
     * @param {string} tenantId - Tenant UUID (ownership check)
     */
    async deleteRule(id: string, tenantId: string) {
        return this.alertsRepo.deleteRule(id, tenantId);
    }

    /**
     * User/Manual trigger to resolve an ongoing alert incident.
     * @param {string} id - Rule UUID
     * @param {string} tenantId - Tenant UUID (ownership check)
     * @returns {Promise<boolean>} True if resolved
     */
    async resolveAlert(id: string, tenantId: string) {
        return this.alertsRepo.resolveAlert(id, tenantId);
    }

    /**
     * Retrieves paginated alert history for a project.
     * @param {string} tenantId - Tenant UUID
     * @param {string} projectId - Project id
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     */
    async getAlertHistory(tenantId: string, projectId: string, page: number = 1, limit: number = 20) {
        return this.alertsRepo.getAlertHistory(tenantId, projectId, page, limit);
    }

    // -- Worker / System Logic -------

    /**
     * Evaluates all enabled rules for a single project.
     * Called by the AlertWorker for each project that has enabled rules.
     *
     * Flow:
     *   1. Fetch all enabled rules for this project
     *   2. For each rule, calculate the relevant metric over the rule's window
     *   3. If condition is true AND rule is not silenced → trigger alert
     *   4. If condition is false → no-op
     *
     * @param {any} pool - PostgreSQL Pool (shared across the tick)
     * @param {string} projectId - Project id
     */
    async evaluateProjectRules(pool: any, projectId: string) {
        const rules = await this.alertsRepo.getEnabledRulesForProject(projectId);

        if (rules.length === 0) return;


        for (const rule of rules) {
            try {
                const metricValue = await this.calculateMetric(pool, rule);
                const triggered = this.checkCondition(metricValue, rule);

                if (triggered) {
                    if (rule.status !== "triggered") {
                        // Check if it's currently silenced (manual or cooldown)
                        if (rule.silence_until && new Date() < new Date(rule.silence_until)) {
                            continue; // Suppressed
                        }
                        await this.triggerAlert(pool, rule, metricValue);
                    }
                    // If already triggered, we do nothing to avoid email/history spam.
                } else {
                    if (rule.status === "triggered") {
                        // Metric recovered, resolve the alert
                        await this.alertsRepo.resolveAlert(rule.id);
                        log.info(`Rule ${rule.id} (${rule.name}) automatically resolved back to normal.`);
                    }
                }
            } catch (error) {
                log.error(
                    `Failed to evaluate rule ${rule.id} (${rule.name}) in project ${projectId}`,
                    undefined,
                    error instanceof Error ? error : undefined,
                );
                // Continue evaluating remaining rules in this project
            }
        }
    }

    // -- Private helpers -------------

    /**
     * Calculates the metric value for a rule's project within the time window.
     * @param {any} pool - PG pool
     * @param {AlertRule} rule - Alert rule (contains project_id)
     * @returns {Promise<number>} Metric value
     */
    private async calculateMetric(pool: any, rule: AlertRule): Promise<number> {
        const windowMinutes = rule.window_minutes || 5;

        let query = "";

        if (rule.metric === "error_rate") {
            query = `
                SELECT 
                    COALESCE(
                        ROUND(100.0 * SUM(failure_count) / NULLIF(SUM(total_requests), 0), 2),
                        0
                    )::float as val
                FROM minute_metrics
                WHERE project_id = $1 
                  AND minute_bucket >= NOW() - make_interval(mins => $2)
            `;
        } else if (rule.metric === "latency") {
            query = `
                SELECT 
                    COALESCE(
                        ROUND(SUM(total_latency) / NULLIF(SUM(total_requests), 0)), 
                        0
                    )::float as val
                FROM minute_metrics
                WHERE project_id = $1 
                  AND minute_bucket >= NOW() - make_interval(mins => $2)
            `;
        } else if (rule.metric === "request_count") {
            query = `
                SELECT COALESCE(SUM(total_requests), 0)::float as val
                FROM minute_metrics
                WHERE project_id = $1 
                  AND minute_bucket >= NOW() - make_interval(mins => $2)
            `;
        } else {
            return 0;
        }

        const result = await pool.query(query, [rule.project_id, windowMinutes]);
        return result.rows[0]?.val ?? 0;
    }

    /**
     * Checks whether the metric value satisfies the rule condition.
     * @param {number} value - Current metric value
     * @param {AlertRule} rule - Rule with condition and threshold
     * @returns {boolean} True if the rule should fire
     */
    private checkCondition(value: number, rule: AlertRule): boolean {
        if (rule.condition === ">") return value > rule.threshold;
        if (rule.condition === "<") return value < rule.threshold;
        return false;
    }

    /**
     * Fires an alert: atomically records history + silences the rule,
     * then sends an email notification if severity is critical.
     * @param {any} pool - Postgres Pool
     * @param {AlertRule} rule - The triggered rule
     * @param {number} value - The metric value that caused the trigger
     */
    private async triggerAlert(pool: any, rule: AlertRule, value: number) {
        log.warn(`🚨 ALERT: '${rule.name}' (${rule.id}) - value=${value} threshold=${rule.threshold}`);

        const silenceUntil = new Date(Date.now() + rule.cooldown_minutes * 60 * 1000);

        // Single atomic transaction: insert history + silence rule
        await this.alertsRepo.recordAlertAndSilence(
            {
                rule_id: rule.id,
                project_id: rule.project_id,
                tenant_id: rule.tenant_id,
                metric_value: value,
                severity: rule.severity || "warning",
            },
            rule.id,
            silenceUntil,
        );

        // Send email notification only if the rule has email enabled
        if (rule.send_email) {
            try {
                const tenantRes = await pool.query(
                    "SELECT email FROM tenants WHERE id = $1",
                    [rule.tenant_id],
                );
                const tenantEmail = tenantRes.rows[0]?.email;
                if (tenantEmail) {
                    const channel = await RabbitMQ.getChannel();
                    channel.sendToQueue(
                        QUEUES.EMAIL_ALERTS,
                        Buffer.from(JSON.stringify({
                            to: tenantEmail,
                            data: {
                                ruleName: rule.name,
                                metric: rule.metric,
                                value,
                                threshold: rule.threshold,
                            }
                        })),
                        { persistent: true }
                    );
                } else {
                    log.warn(`Cannot send critical alert email: tenant ${rule.tenant_id} has no email`);
                }
            } catch (err) {
                log.error(
                    `Failed to send email for rule ${rule.id}`,
                    undefined,
                    err instanceof Error ? err : undefined,
                );
            }
        }
    }
}
