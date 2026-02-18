import { PostgreSQL } from "../../config/db/postgres.js";
import type { AlertRule, AlertHistory } from "./alerts.model.js";
import { AppError } from "../../shared/errors/AppError.js";

export class AlertsRepository {

    // ── Rules CRUD ──

    async createRule(rule: Partial<AlertRule>): Promise<AlertRule> {
        const pool = PostgreSQL.getPool();
        const query = `
            INSERT INTO alert_rules (
                tenant_id, name, metric, condition, threshold,
                severity, window_minutes, cooldown_minutes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        const values = [
            rule.tenant_id, rule.name, rule.metric, rule.condition,
            rule.threshold, rule.severity || "warning",
            rule.window_minutes || 5, rule.cooldown_minutes || 60
        ];

        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            throw new AppError(500, "Failed to create alert rule", error);
        }
    }

    async getRules(tenantId: string): Promise<AlertRule[]> {
        const pool = PostgreSQL.getPool();
        const result = await pool.query(
            "SELECT * FROM alert_rules WHERE tenant_id = $1 ORDER BY created_at DESC",
            [tenantId]
        );
        return result.rows;
    }

    async updateRule(id: string, tenantId: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
        const pool = PostgreSQL.getPool();
        // Dynamic update query — only set fields that are provided
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
        if (updates.metric !== undefined) { fields.push(`metric = $${idx++}`); values.push(updates.metric); }
        if (updates.condition !== undefined) { fields.push(`condition = $${idx++}`); values.push(updates.condition); }
        if (updates.threshold !== undefined) { fields.push(`threshold = $${idx++}`); values.push(updates.threshold); }
        if (updates.window_minutes !== undefined) { fields.push(`window_minutes = $${idx++}`); values.push(updates.window_minutes); }
        if (updates.cooldown_minutes !== undefined) { fields.push(`cooldown_minutes = $${idx++}`); values.push(updates.cooldown_minutes); }
        if (updates.enabled !== undefined) { fields.push(`enabled = $${idx++}`); values.push(updates.enabled); }
        if (updates.severity !== undefined) { fields.push(`severity = $${idx++}`); values.push(updates.severity); }

        if (fields.length === 0) return null; // No updates provided

        // Tenant ownership check via WHERE
        values.push(id);
        values.push(tenantId);

        const query = `
            UPDATE alert_rules 
            SET ${fields.join(", ")}, updated_at = NOW()
            WHERE id = $${idx++} AND tenant_id = $${idx++}
            RETURNING *;
        `;

        try {
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            throw new AppError(500, "Failed to update alert rule", error);
        }
    }

    async deleteRule(id: string, tenantId: string): Promise<boolean> {
        const pool = PostgreSQL.getPool();
        const result = await pool.query(
            "DELETE FROM alert_rules WHERE id = $1 AND tenant_id = $2",
            [id, tenantId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    // ── Internal System Methods (for Job) ──

    async getAllEnabledRules(): Promise<AlertRule[]> {
        const pool = PostgreSQL.getPool();
        const result = await pool.query("SELECT * FROM alert_rules WHERE enabled = TRUE");
        return result.rows;
    }

    async silenceRule(id: string, until: Date): Promise<void> {
        const pool = PostgreSQL.getPool();
        await pool.query(
            "UPDATE alert_rules SET silence_until = $1 WHERE id = $2",
            [until, id]
        );
    }

    // ── History ──

    async recordAlertHistory(history: Partial<AlertHistory>): Promise<void> {
        const pool = PostgreSQL.getPool();
        await pool.query(
            `INSERT INTO alert_history (rule_id, tenant_id, metric_value, severity)
             VALUES ($1, $2, $3, $4)`,
            [history.rule_id, history.tenant_id, history.metric_value, history.severity || "warning"]
        );
    }

    /**
     * Retrieves paginated alert history for a tenant with rule names.
     * @param {string} tenantId - The tenant's ID
     * @param {number} page - Page number (1-based)
     * @param {number} limit - Items per page
     * @returns {Promise<{ data: AlertHistory[], total: number }>}
     */
    async getAlertHistory(tenantId: string, page: number = 1, limit: number = 20)
        : Promise<{ data: AlertHistory[]; total: number }> {
        const pool = PostgreSQL.getPool();
        const offset = (page - 1) * limit;

        const countResult = await pool.query(
            "SELECT COUNT(*) FROM alert_history WHERE tenant_id = $1",
            [tenantId]
        );

        const result = await pool.query(
            `SELECT ah.*, ar.name as rule_name, ar.severity
             FROM alert_history ah
             LEFT JOIN alert_rules ar ON ah.rule_id = ar.id
             WHERE ah.tenant_id = $1
             ORDER BY ah.triggered_at DESC
             LIMIT $2 OFFSET $3`,
            [tenantId, limit, offset]
        );

        return {
            data: result.rows,
            total: parseInt(countResult.rows[0].count, 10),
        };
    }
}
