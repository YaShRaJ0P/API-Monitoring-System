import { AlertsService } from "./alerts.service.js";
import { AlertsRepository } from "./alerts.repository.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("AlertsJob");

export class AlertsJob {
    private intervalParams: NodeJS.Timeout | null = null;
    private readonly service: AlertsService;

    constructor() {
        // Instantiate dependencies manually or via DI container if available
        const repo = new AlertsRepository();
        this.service = new AlertsService(repo);
    }

    /**
     * Starts the alert evaluation loop.
     * @param intervalMs - Check interval in milliseconds (default: 60000ms = 1m)
     */
    start(intervalMs = 60000) {
        if (this.intervalParams) {
            log.warn("Alerts job already running");
            return;
        }

        log.info(`Starting alerts evaluation job (interval: ${intervalMs}ms)`);

        this.intervalParams = setInterval(async () => {
            try {
                await this.service.evaluateRules();
                // log.debug("Alerts evaluation cycle completed");
            } catch (error) {
                log.error("Alerts evaluation cycle failed", undefined, error instanceof Error ? error : undefined);
            }
        }, intervalMs);
    }

    /**
     * Stops the alert evaluation loop.
     */
    stop() {
        if (this.intervalParams) {
            clearInterval(this.intervalParams);
            this.intervalParams = null;
            log.info("Alerts job stopped");
        }
    }
}
