import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../shared/types/auth.types.js";
import { AppError } from "../../shared/errors/AppError.js";
import OutboxEntry from "../../models/OutboxEntry.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("DLQController");

/**
 * DLQ (Dead Letter Queue) API for monitoring and replaying failed outbox entries.
 * Failed entries are automatically created by the OutboxProcessor when an entry
 * exceeds MAX_ATTEMPTS.
 */

const createDlqRouter = () => {
    const router = Router();

    /**
     * GET /admin/dlq
     * Returns paginated list of failed outbox entries.
     * @query {number} page - Page number (default: 1)
     * @query {number} limit - Items per page (default: 20)
     */
    router.get("/", async (req: Request, res: Response, next: NextFunction) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const skip = (page - 1) * limit;

            const [entries, total] = await Promise.all([
                OutboxEntry.find({ status: "failed" })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                OutboxEntry.countDocuments({ status: "failed" }),
            ]);

            res.json({
                success: true,
                data: entries,
                total,
                page,
                totalPages: Math.ceil(total / limit),
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /admin/dlq/stats
     * Returns counts of outbox entries by status.
     */
    router.get("/stats", async (req: Request, res: Response, next: NextFunction) => {
        try {
            const [pending, processed, failed] = await Promise.all([
                OutboxEntry.countDocuments({ status: "pending" }),
                OutboxEntry.countDocuments({ status: "processed" }),
                OutboxEntry.countDocuments({ status: "failed" }),
            ]);

            res.json({
                success: true,
                data: { pending, processed, failed, total: pending + processed + failed },
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /admin/dlq/replay/:id
     * Resets a failed entry back to "pending" so the OutboxProcessor retries it.
     * @param {string} id - MongoDB ObjectId of the outbox entry
     */
    router.post("/replay/:id", async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            const entry = await OutboxEntry.findById(id);
            if (!entry) throw new AppError(404, "DLQ entry not found");
            if (entry.status !== "failed") {
                throw new AppError(400, `Cannot replay entry with status '${entry.status}'`);
            }

            entry.status = "pending";
            entry.attempts = 0;
            entry.lastError = "";
            await entry.save();

            log.info(`Replayed DLQ entry ${entry.event_id}`);
            res.json({ success: true, message: "Entry queued for replay" });
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /admin/dlq/replay-all
     * Resets all failed entries back to "pending".
     */
    router.post("/replay-all", async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await OutboxEntry.updateMany(
                { status: "failed" },
                { $set: { status: "pending", attempts: 0 }, $unset: { lastError: 1 } }
            );

            log.info(`Replayed ${result.modifiedCount} DLQ entries`);
            res.json({
                success: true,
                message: `${result.modifiedCount} entries queued for replay`,
            });
        } catch (error) {
            next(error);
        }
    });

    return router;
};

export const dlqRouter = createDlqRouter();
