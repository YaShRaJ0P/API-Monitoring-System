import type { Pool } from "pg";

export class DLQRepository {
    constructor(private readonly pool: Pool) {}

    /**
     * Get all Failed Entries
     * @param {number} limit - Limit
     * @param {number} offset - Offset
     * @returns {Promise<any>} Object with entries and total count
     */
    async getFailedEntries(limit: number, offset: number) {
        const entriesResult = await this.pool.query(
            `SELECT event_id, payload, status, attempts, last_error, created_at, processed_at
             FROM outbox_entries
             WHERE status = 'failed'
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        const countResult = await this.pool.query(
            `SELECT COUNT(*) as total FROM outbox_entries WHERE status = 'failed'`
        );
        const total = parseInt(countResult.rows[0].total, 10);

        return { entries: entriesResult.rows, total };
    }

    /**
     * Get DLQ Stats
     * @returns {Promise<any>} Object with stats
     */
    async getStats() {
        const result = await this.pool.query(`
            SELECT 
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
            FROM outbox_entries
        `);
        return result.rows[0];
    }

    /**
     * Get Entry Status
     * @param {string} id - Entry ID
     * @returns {Promise<any>} Object with status
     */
    async getEntryStatus(id: string) {
        const checkResult = await this.pool.query(
            `SELECT status FROM outbox_entries WHERE event_id = $1`,
            [id]
        );
        return checkResult.rows[0];
    }

    /**
     * Update Entry to Pending
     * @param {string} id - Entry ID
     * @returns {Promise<number>} Number of rows updated
     */
    async updateEntryToPending(id: string) {
        const result = await this.pool.query(
            `UPDATE outbox_entries 
             SET status = 'pending', attempts = 0, last_error = NULL
             WHERE event_id = $1`,
            [id]
        );
        return result.rowCount ?? 0;
    }

    /**
     * Update All Failed to Pending
     * @returns {Promise<number>} Number of rows updated
     */
    async updateAllFailedToPending() {
        const result = await this.pool.query(
            `UPDATE outbox_entries 
             SET status = 'pending', attempts = 0, last_error = NULL
             WHERE status = 'failed'`
        );
        return result.rowCount ?? 0;
    }
}
