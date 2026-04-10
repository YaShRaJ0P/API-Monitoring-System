import type { Pool } from "pg";
import type { IProject } from "./tenant.entity.js";

import crypto from "crypto";
import { encryptSecret, decryptSecret } from "../../shared/utils/crypto.js";

/**
 * Repository for tenant and project database operations.
 * Handles project CRUD and tenant lookups via PostgreSQL.
 */
export class TenantRepository {
    constructor(private readonly pool: Pool) { }

    /**
     * Creates a new project for the given tenant.
     * @param {string} tenantId - Tenant UUID
     * @param {string} name - Project name
     * @returns {Promise<IProject>} Created project with env_id
     */
    async createProject(tenantId: string, name: string): Promise<IProject> {
        const rawSecret   = crypto.randomBytes(32).toString('hex');
        const storedSecret = encryptSecret(rawSecret);

        const result = await this.pool.query<IProject>(
            `INSERT INTO projects (tenant_id, name, api_secret)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [tenantId, name, storedSecret]
        );

        const project = result.rows[0]!;
        project.api_secret = rawSecret;
        return project;
    }

    /**
     * Lists all projects for a tenant.
     * @param {string} tenantId - Tenant UUID
     * @returns {Promise<IProject[]>} Array of projects
     */
    async listProjects(tenantId: string): Promise<IProject[]> {
        const result = await this.pool.query<IProject>(
            `SELECT * FROM projects WHERE tenant_id = $1 ORDER BY created_at DESC`,
            [tenantId]
        );
        return result.rows.map(p => ({
            ...p,
            api_secret: decryptSecret(p.api_secret)
        }));
    }

    /**
     * Deletes a project by id, scoped to tenant for security.
     * @param {string} id - Internal project UUID
     * @param {string} tenantId - Tenant UUID (ownership check)
     * @returns {Promise<boolean>} True if deleted
     */
    async deleteProject(id: string, tenantId: string): Promise<boolean> {
        const result = await this.pool.query(
            `DELETE FROM projects WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );
        return (result.rowCount ?? 0) > 0;
    }
}