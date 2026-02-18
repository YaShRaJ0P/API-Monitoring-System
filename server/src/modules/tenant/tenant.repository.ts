import type { Pool } from "pg";
import type { ITenant } from "./tenant.entity.js";

export class TenantRepository {
    constructor(private readonly pool: Pool) { }

    /**
     * Generates and assigns a new env_id (API key) for an existing tenant.
     * @param {string} id - Tenant UUID
     * @param {string} envId - The generated env_id (API key)
     * @returns {ITenant | null} Updated tenant or null if not found
     */
    async assignApiKey({ id, envId }: { id: string, envId: string }): Promise<ITenant | null> {
        const result = await this.pool.query<ITenant>(
            `UPDATE tenants 
             SET env_id = $2, updated_at = NOW() 
             WHERE id = $1
             RETURNING *`,
            [id, envId]
        );
        return result.rows[0] ?? null;
    }

    /**
     * Finds a tenant by their env_id (API key).
     * @param {string} envId - Environment ID / API key
     * @returns {ITenant | null} Matching tenant or null
     */
    async findByEnvId(envId: string): Promise<ITenant | null> {
        const result = await this.pool.query<ITenant>(
            `SELECT * FROM tenants WHERE env_id = $1`,
            [envId]
        );
        return result.rows[0] ?? null;
    }
}