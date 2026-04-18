import type { IngestionService } from "./ingestion.service.js";
import type { AuthRequest } from "../../shared/types/auth.types.js";
import type { Request, Response, NextFunction } from "express";
import response from "../../shared/utils/response.js";
import { validateIngestion } from "./ingestion.validator.js";
import { AppError } from "../../shared/errors/AppError.js";
import { generateEventId } from "../../shared/utils/generateEventId.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("IngestionController");

/**
 * Controller for telemetry data ingestion.
 */
export class IngestionController {
    constructor(private readonly ingestionService: IngestionService) { }

    /**
     * Ingests a single telemetry event from an authenticated SDK client.
     *
     * @param {Request}      req  - Express request
     * @param {Response}     res  - Express response
     * @param {NextFunction} next - Express next function
     */
    ingestData = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authReq = req as AuthRequest;
            const tenantId = authReq.id;
            const projectId = authReq.project_id;

            if (!tenantId || !projectId) {
                throw new AppError(401, "Unauthorized - API key context missing");
            }

            const xTimestamp = req.headers["x-timestamp"] as string;
            const eventTimestamp = new Date(parseInt(xTimestamp, 10)).toISOString();

            const data = {
                ...authReq.body,
                tenant_id: tenantId,
                project_id: projectId,
                event_id: generateEventId(),
                timestamp: eventTimestamp,
            };

            log.debug(`Ingesting event for tenant=${tenantId} project=${projectId}`);

            const validationResult = validateIngestion(data);

            if (!validationResult.success) {
                return response(res, 400, "Validation failed", validationResult.error);
            }
            const t0 = Date.now();

            // after auth middleware (already done by here)
            const t1 = Date.now();

            const result = await this.ingestionService.ingestData(validationResult.data);
            const t2 = Date.now();

            log.debug(`auth: ${t1 - t0}ms | ingest: ${t2 - t1}ms | total: ${t2 - t0}ms`);

            
            if (result.buffered) {
                // 202 Accepted - the circuit breaker is open; event is safely buffered in Redis
                return response(res, 202, "Event accepted and buffered for processing", null);
            }

            response(res, 200, "Event ingested successfully", null);

        } catch (error) {
            next(error);
        }
    };
}