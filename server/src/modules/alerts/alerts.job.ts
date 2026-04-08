import { AlertsRepository } from "./alerts.repository.js";
import { AlertsService } from "./alerts.service.js";
import { PostgreSQL } from "../../config/db/postgres.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("AlertWorker");

/**
 * Background worker that evaluates alert rules on a fixed timer.
 *
 * Flow (every X seconds):
 *   1. Get all active projects that have at least one alert rule
 *   2. For each project, fetch recent metrics (last N minutes window)
 *   3. For each rule within the project, evaluate the condition
 *   4. If the condition fires → record history, silence the rule, send email if critical
 *   5. If the condition does not fire → no-op (silence cooldown handles re-trigger prevention)
 */
export class AlertWorker {
    private timer: NodeJS.Timeout | null = null;
    private readonly service: AlertsService;
    private running = false;

    constructor() {
        const repo = new AlertsRepository();
        this.service = new AlertsService(repo);
    }

    /**
     * Starts the alert evaluation loop.
     * @param {number} intervalMs - Tick interval in milliseconds (default 60 000 = 1 min)
     */
    start(intervalMs: number = 60_000) {
        if (this.timer) {
            log.warn("AlertWorker already running");
            return;
        }

        log.info(`AlertWorker started (interval: ${intervalMs}ms)`);

        // Run once immediately on startup, then on the interval
        this.tick();
        this.timer = setInterval(() => this.tick(), intervalMs);
    }

    /**
     * Stops the worker gracefully.
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            log.info("AlertWorker stopped");
        }
    }

    /**
     * Single evaluation tick.
     * Guards against overlapping ticks (if a previous one is still running).
     */
    private async tick() {
        if (this.running) {
            log.warn("Previous AlertWorker tick still running");
            return;
        }

        this.running = true;

        try {
            const pool = PostgreSQL.getPool();

            // 1. Get all distinct projects that have at least one enabled rule
            const projectsResult = await pool.query(
                `SELECT DISTINCT project_id, tenant_id
                 FROM alert_rules
                 WHERE enabled = TRUE`,
            );
            const projects = projectsResult.rows as { project_id: string; tenant_id: string }[];

            if (projects.length === 0) {
                return;
            }

            // 2. For each project, evaluate its rules
            for (const { project_id } of projects) {
                try {
                    await this.service.evaluateProjectRules(pool, project_id);
                } catch (err) {
                    log.error(
                        `Failed to evaluate rules for project ${project_id}`,
                        undefined,
                        err instanceof Error ? err : undefined,
                    );
                }
            }
        } catch (err) {
            log.error("AlertWorker tick failed", undefined, err instanceof Error ? err : undefined);
        } finally {
            this.running = false;
        }
    }
}
