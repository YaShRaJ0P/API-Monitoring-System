import type { IngestionService } from "./ingestion.service.js";
import type { AuthRequest } from "../../shared/types/auth.types.js";
import type { Request, Response, NextFunction } from "express";
import response from "../../shared/utils/response.js";
import { validateIngestion } from "./ingestion.validator.js";
import { AppError } from "../../shared/errors/AppError.js";
import { generateEventId } from "../../shared/utils/generateEventId.js";

/**
 * Controller for telemetry data ingestion.
 * Validates incoming payloads and delegates to IngestionService.
 */
export class IngestionController {
    constructor(private readonly ingestionService: IngestionService) { }

    /**
     * Validates and ingests telemetry data from the authenticated client.
     * Returns 200 if published directly, 202 if buffered due to circuit breaker.
     * @param {AuthRequest} req - Express request with authenticated tenant ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    ingestData = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = req.body;

            const userId = (req as AuthRequest).id;
            if (!userId) {
                throw new AppError(401, "Unauthorized");
            }

            data.tenant_id = userId;
            data.event_id = generateEventId();

            const validationResponse = validateIngestion(data);

            if (!validationResponse.success) {
                return response(res, 400, "Invalid data", validationResponse.error);
            }

            const validatedData = validationResponse.data;
            const result = await this.ingestionService.ingestData(validatedData);

            if (result.buffered) {
                // 202 = Accepted but not yet processed (buffered due to circuit breaker)
                return response(res, 202, "Data accepted and buffered for processing", null);
            }

            response(res, 200, "Data ingested successfully", null);
        } catch (error) {
            next(error);
        }
    }
}