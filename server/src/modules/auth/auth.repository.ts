import type { Pool } from "pg";
import type { ITenant } from "../tenant/tenant.entity.js";

/**
 * Repository for tenant authentication data in PostgreSQL.
 * Provides CRUD operations for the tenants table.
 */
export class AuthRepository {
    constructor(private readonly pgPool: Pool) { }

    /**
     * Finds a tenant by their email address.
     * @param {string} email - Tenant email
     * @returns {Promise<ITenant | null>} Matching tenant or null
     */
    async findByEmail(email: string): Promise<ITenant | null> {
        const result = await this.pgPool.query<ITenant>(
            "SELECT * FROM tenants WHERE email = $1",
            [email]
        );
        return result.rows[0] || null;
    }

    /**
     * Finds a tenant by their UUID.
     * @param {string} id - Tenant UUID
     * @returns {Promise<ITenant | null>} Matching tenant or null
     */
    async findById(id: string): Promise<ITenant | null> {
        const result = await this.pgPool.query<ITenant>(
            "SELECT * FROM tenants WHERE id = $1",
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Finds a tenant by their Google OAuth ID.
     * @param {string} googleId - Google profile ID
     * @returns {Promise<ITenant | null>} Matching tenant or null
     */
    async findByGoogleId(googleId: string): Promise<ITenant | null> {
        const result = await this.pgPool.query<ITenant>(
            "SELECT * FROM tenants WHERE google_id = $1",
            [googleId]
        );
        return result.rows[0] || null;
    }

    /**
     * Creates a new tenant record.
     * @param {Partial<ITenant>} data - Tenant data (email, google_id, name, avatar)
     * @returns {Promise<ITenant>} Newly created tenant
     */
    async createTenant(data: Partial<ITenant>): Promise<ITenant> {
        const result = await this.pgPool.query<ITenant>(
            `INSERT INTO tenants (email, google_id, name, avatar) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [data.email, data.google_id, data.name, data.avatar]
        );
        return result.rows[0]!;
    }

    /**
     * Updates the stored refresh token for a tenant.
     * @param {string} id - Tenant UUID
     * @param {string | null} refreshToken - New refresh token, or null to revoke
     * @returns {Promise<void>}
     */
    async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
        await this.pgPool.query(
            "UPDATE tenants SET refresh_token = $1, updated_at = NOW() WHERE id = $2",
            [refreshToken, id]
        );
    }
}

