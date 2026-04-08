import { PostgreSQL } from "../../config/db/postgres.js";

export class AdminRepository {

    /**
     * Get all Users
     * @returns {Promise<any[]>} Array of users with project counts
     */
    async getUsers() {
        const pool = PostgreSQL.getPool();
        const result = await pool.query(`
            SELECT
                t.id,
                t.name,
                t.email,
                t.avatar,
                t.is_admin,
                t.created_at,
                COUNT(p.id)::int AS project_count
            FROM tenants t
            LEFT JOIN projects p ON p.tenant_id = t.id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `);
        return result.rows;
    }

    /**
     * Delete User
     * @param {string} id - User ID
     * @returns {Promise<number>} Number of users deleted
     */
    async deleteUser(id: string) {
        const pool = PostgreSQL.getPool();
        const result = await pool.query(
            "DELETE FROM tenants WHERE id = $1 RETURNING id",
            [id],
        );
        return result.rowCount ?? 0;
    }

    /**
     * Toggle Admin
     * @param {string} id - User ID
     * @returns {Promise<any>} Updated user
     */
    async toggleAdmin(id: string) {
        const pool = PostgreSQL.getPool();
        const result = await pool.query(
            `UPDATE tenants
             SET is_admin = NOT is_admin, updated_at = NOW()
             WHERE id = $1
             RETURNING id, is_admin`,
            [id],
        );
        return result.rows[0] || null;
    }

    /**
     * Get System Stats
     * @returns {Promise<any>} System stats
     */
    async getSystemStats() {
        const pool = PostgreSQL.getPool();
        const [tenants, projects, rules, outbox] = await Promise.all([
            pool.query("SELECT COUNT(*) AS total FROM tenants"),
            pool.query("SELECT COUNT(*) AS total FROM projects"),
            pool.query("SELECT COUNT(*) AS total FROM alert_rules WHERE enabled = TRUE"),
            pool.query(`
                SELECT
                    COUNT(CASE WHEN status = 'pending' THEN 1 END)   AS pending,
                    COUNT(CASE WHEN status = 'processed' THEN 1 END) AS processed,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END)    AS failed
                FROM outbox_entries
            `),
        ]);
        return { tenants, projects, rules, outbox };
    }
}
