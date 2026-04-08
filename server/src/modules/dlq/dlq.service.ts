import { DLQRepository } from "./dlq.repository.js";
import { AppError } from "../../shared/errors/AppError.js";

export class DLQService {
    constructor(private readonly dlqRepo: DLQRepository) {}

    /**
     * Get all Failed Entries
     * @param {number} page - Page number
     * @param {number} limit - Limit
     * @returns {Promise<any>} Object with entries and pagination
     */
    async getFailedEntries(page: number, limit: number) {
        const offset = (page - 1) * limit;
        const { entries, total } = await this.dlqRepo.getFailedEntries(limit, offset);
        return {
            data: entries,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get DLQ Stats
     * @returns {Promise<any>} Object with stats
     */
    async getStats() {
        const row = await this.dlqRepo.getStats();
        const pending = parseInt(row.pending || '0', 10);
        const processed = parseInt(row.processed || '0', 10);
        const failed = parseInt(row.failed || '0', 10);
        return { pending, processed, failed, total: pending + processed + failed };
    }

    /**
     * Replay DLQ Entry
     * @param {string} id - Entry ID
     * @returns {Promise<boolean>} True if successful
     */
    async replayEntry(id: string) {
        const entry = await this.dlqRepo.getEntryStatus(id);
        if (!entry) {
            throw new AppError(404, "DLQ entry not found");
        }
        if (entry.status !== "failed") {
            throw new AppError(400, `Cannot replay entry with status '${entry.status}'`);
        }
        await this.dlqRepo.updateEntryToPending(id);
        return true;
    }

    /**
     * Replay All Failed Entries
     * @returns {Promise<number>} Number of entries replayed
     */
    async replayAll() {
        return this.dlqRepo.updateAllFailedToPending();
    }
}
