import { PostgreSQL } from "../../config/db/postgres.js";
import type { AlertRule, AlertHistory } from "./alerts.model.js";
import { AppError } from "../../shared/errors/AppError.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("AlertsRepository");

/**
 * Repository for alert rules and alert history.
 * All operations are now scoped by project_id.
 */
export class AlertsRepository {
  /**
   * Creates a new alert rule for a specific project.
   * @param {Partial<AlertRule>} rule - Rule data including project_id and tenant_id
   * @returns {Promise<AlertRule>} Created rule
   */
  async createRule(rule: Partial<AlertRule>): Promise<AlertRule> {
    const pool = PostgreSQL.getPool();
    const query = `
            INSERT INTO alert_rules (
                project_id, tenant_id, name, metric, condition, threshold,
                severity, window_minutes, cooldown_minutes, send_email
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *;
        `;
    const values = [
      rule.project_id,
      rule.tenant_id,
      rule.name,
      rule.metric,
      rule.condition,
      rule.threshold,
      rule.severity || "warning",
      rule.window_minutes || 5,
      rule.cooldown_minutes || 60,
      rule.send_email ?? false,
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw new AppError(500, "Failed to create alert rule", error);
    }
  }

  /**
   * Lists all alert rules for a specific project.
   * @param {string} tenantId - Tenant UUID
   * @param {string} projectId - Project id
   * @returns {Promise<AlertRule[]>} Array of rules
   */
  async getRules(tenantId: string, projectId: string): Promise<AlertRule[]> {
    const pool = PostgreSQL.getPool();
    const result = await pool.query(
      "SELECT * FROM alert_rules WHERE project_id = $1 AND tenant_id = $2 ORDER BY created_at DESC",
      [projectId, tenantId],
    );
    return result.rows;
  }

  /**
   * Updates an alert rule, with tenant ownership check.
   * @param {string} id - Rule UUID
   * @param {string} tenantId - Tenant UUID
   * @param {Partial<AlertRule>} updates - Fields to update
   * @returns {Promise<AlertRule | null>} Updated rule or null
   */
  async updateRule(
    id: string,
    tenantId: string,
    updates: Partial<AlertRule>,
  ): Promise<AlertRule | null> {
    const pool = PostgreSQL.getPool();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;


    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.metric !== undefined) {
      fields.push(`metric = $${idx++}`);
      values.push(updates.metric);
    }
    if (updates.condition !== undefined) {
      fields.push(`condition = $${idx++}`);
      values.push(updates.condition);
    }
    if (updates.threshold !== undefined) {
      fields.push(`threshold = $${idx++}`);
      values.push(updates.threshold);
    }
    if (updates.window_minutes !== undefined) {
      fields.push(`window_minutes = $${idx++}`);
      values.push(updates.window_minutes);
    }
    if (updates.cooldown_minutes !== undefined) {
      fields.push(`cooldown_minutes = $${idx++}`);
      values.push(updates.cooldown_minutes);
    }
    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${idx++}`);
      values.push(updates.enabled);
    }
    if (updates.severity !== undefined) {
      fields.push(`severity = $${idx++}`);
      values.push(updates.severity);
    }
    if (updates.send_email !== undefined) {
      fields.push(`send_email = $${idx++}`);
      values.push(updates.send_email);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }

    if (fields.length === 0) return null;

    values.push(id);
    values.push(tenantId);

    const query = `
            UPDATE alert_rules 
            SET ${fields.join(", ")}
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

  /**
   * Deletes an alert rule, scoped by tenant ownership.
   * @param {string} id - Rule UUID
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteRule(id: string, tenantId: string): Promise<boolean> {
    const pool = PostgreSQL.getPool();

    const result = await pool.query(
      "DELETE FROM alert_rules WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  // -- Internal System Methods (for Job) --

  /**
   * Returns all enabled alert rules across all projects.
   * @returns {Promise<AlertRule[]>} Enabled rules
   */
  async getAllEnabledRules(): Promise<AlertRule[]> {
    const pool = PostgreSQL.getPool();
    const result = await pool.query(
      "SELECT * FROM alert_rules WHERE enabled = TRUE",
    );
    return result.rows;
  }

  /**
   * Returns all enabled alert rules for a specific project.
   * @param {string} projectId - Project id
   * @returns {Promise<AlertRule[]>} Enabled rules for this project
   */
  async getEnabledRulesForProject(projectId: string): Promise<AlertRule[]> {
    const pool = PostgreSQL.getPool();
    const result = await pool.query(
      "SELECT * FROM alert_rules WHERE project_id = $1 AND enabled = TRUE",
      [projectId],
    );
    return result.rows;
  }

  /**
   * Silences a rule until a specific time (cooldown).
   * @param {string} id - Rule UUID
   * @param {Date} until - Silence until this time
   */
  async silenceRule(id: string, until: Date): Promise<void> {
    const pool = PostgreSQL.getPool();
    await pool.query(
      "UPDATE alert_rules SET silence_until = $1 WHERE id = $2",
      [until, id],
    );
  }

  // -- History --

  /**
   * Atomically records a triggered alert in history AND silences the rule.
   * Uses a single transaction so a partial failure can't leave the rule un-silenced.
   * @param {Partial<AlertHistory>} history - Alert history data
   * @param {string} ruleId - Rule to silence
   * @param {Date} silenceUntil - Silence expiry time
   * @returns {Promise<AlertHistory>} The inserted history row (with rule_name from JOIN)
   */
  async recordAlertAndSilence(
    history: Partial<AlertHistory>,
    ruleId: string,
    silenceUntil: Date,
  ): Promise<AlertHistory> {
    const pool = PostgreSQL.getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      if (history.metric_value === undefined) {
        throw new AppError(400, "metric_value is required");
      }

      // Lock + cooldown check in DB
      const ruleResult = await client.query(
        `SELECT *
                 FROM alert_rules
                 WHERE id = $1
                 FOR UPDATE`,
        [ruleId],
      );

      if (ruleResult.rowCount === 0) {
        throw new AppError(404, "Alert rule not found");
      }

      const rule = ruleResult.rows[0];

      if (rule.silence_until && new Date(rule.silence_until) > new Date()) {
        throw new AppError(409, "Rule is in cooldown");
      }

      const insertResult = await client.query(
        `INSERT INTO alert_history (
                 rule_id, project_id, tenant_id,
                 rule_name, metric, condition, threshold,
                 severity, window_minutes, cooldown_minutes,
                 send_email, silence_until,
                 metric_value, status
            )
            VALUES (
                $1, $2, $3,
                $4, $5, $6, $7,
                $8, $9, $10,
                $11, $12,
                $13, 'triggered'
            )
            RETURNING *`,
        [
          rule.id,
          rule.project_id,
          rule.tenant_id,
          rule.name,
          rule.metric,
          rule.condition,
          rule.threshold,
          rule.severity,
          rule.window_minutes,
          rule.cooldown_minutes,
          rule.send_email,
          silenceUntil,
          history.metric_value,
        ],
      );

      await client.query(
        `UPDATE alert_rules
             SET silence_until = $1,
                 status = 'triggered'
             WHERE id = $2`,
        [silenceUntil, ruleId],
      );

      await client.query("COMMIT");

      return insertResult.rows[0] as AlertHistory;
    } catch (error) {
      await client.query("ROLLBACK");

      log.error(
        "Failed to record alert history + silence rule atomically",
        undefined,
        error instanceof Error ? error : undefined,
      );

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Resolves an ongoing alert incident.
   * Updates the rule back to 'resolved' and closes the open 'triggered' history row with resolved_at.
   * @param {string} ruleId - Rule UUID
   * @param {string} [tenantId] - Optional Tenant UUID to enforce ownership check
   * @returns {Promise<boolean>} True if resolved successfully
   */
  async resolveAlert(ruleId: string, tenantId?: string): Promise<boolean> {
    const pool = PostgreSQL.getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let tenantFilter = "";
      let values: any[] = [ruleId];

      if (tenantId) {
        tenantFilter = " AND tenant_id = $2";
        values.push(tenantId);
      }

      // Mark rule as resolved with optional ownership verification
      const result = await client.query(
        `UPDATE alert_rules SET status = 'resolved' WHERE id = $1${tenantFilter}`,
        values,
      );

      // If rule wasn't found or tenant doesn't own it
      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return false;
      }

      // Close the active incident
      await client.query(
        `UPDATE alert_history
         SET status = 'resolved', resolved_at = NOW()
         WHERE id = (
                SELECT id FROM alert_history
                WHERE rule_id = $1 AND status = 'triggered'
                ORDER BY triggered_at DESC
                LIMIT 1
            )`,
        [ruleId],
      );

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      log.error(
        "Failed to resolve alert incident",
        undefined,
        error instanceof Error ? error : undefined,
      );
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Records a triggered alert event in history (non-atomic, kept for internal use).
   * Prefer `recordAlertAndSilence` for the alert job flow.
   * @param {Partial<AlertHistory>} history - Alert history data
   */
  async recordAlertHistory(history: Partial<AlertHistory>): Promise<void> {
    const pool = PostgreSQL.getPool();
    await pool.query(
      `INSERT INTO alert_history (rule_id, project_id, tenant_id, metric_value, severity, status)
             VALUES ($1, $2, $3, $4, $5, 'triggered')`,
      [
        history.rule_id,
        history.project_id,
        history.tenant_id,
        history.metric_value,
        history.severity || "warning",
      ],
    );
  }

  /**
   * Retrieves paginated alert history for a project with rule names.
   * @param {string} tenantId - Tenant UUID
   * @param {string} projectId - Project id
   * @param {number} page - Page number (1-based)
   * @param {number} limit - Items per page
   * @returns {Promise<{ data: AlertHistory[], total: number }>}
   */
  async getAlertHistory(
    tenantId: string,
    projectId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: AlertHistory[]; total: number }> {
    const pool = PostgreSQL.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      "SELECT COUNT(*) FROM alert_history WHERE project_id = $1 AND tenant_id = $2",
      [projectId, tenantId],
    );

    const result = await pool.query(
      `SELECT *
         FROM alert_history
         WHERE project_id = $1 AND tenant_id = $2
         ORDER BY triggered_at DESC
         LIMIT $3 OFFSET $4`,
      [projectId, tenantId, limit, offset],
    );

    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }
}
