import type { Request, Response, NextFunction } from "express";
import { DLQService } from "./dlq.service.js";
import { createLogger } from "../../shared/utils/logger.js";
import response from "../../shared/utils/response.js";

const log = createLogger("DLQController");

export class DLQController {
    constructor(private readonly dlqService: DLQService) { }

    /**
     * Get all Failed Entries
     * @param {Request} req - Request object
     * @param {Response} res - Response object
     * @param {NextFunction} next - Next function
     */
    getFailedEntries = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            const result = await this.dlqService.getFailedEntries(page, limit);
            response(res, 200, "Failed entries fetched", result);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Get DLQ Stats
     * @param {Request} req - Request object
     * @param {Response} res - Response object
     * @param {NextFunction} next - Next function
     */
    getStats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.dlqService.getStats();
            response(res, 200, "DLQ stats fetched", data);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Replay DLQ Entry
     * @param {Request} req - Request object
     * @param {Response} res - Response object
     * @param {NextFunction} next - Next function
     */
    replayEntry = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            await this.dlqService.replayEntry(id as string);
            log.debug(`Replayed DLQ entry ${id}`);
            response(res, 200, "Entry queued for replay", null);
        } catch (error) {
            next(error);
        }
    };

    replayAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const rowCount = await this.dlqService.replayAll();
            log.debug(`Replayed ${rowCount} DLQ entries`);
            res.json({
                success: true,
                message: `${rowCount} entries queued for replay`,
            });
        } catch (error) {
            next(error);
        }
    };
}
