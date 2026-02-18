import { AppError } from "../../shared/errors/AppError.js";
import type { TenantRepository } from "./tenant.repository.js";
import { generateEventId } from "../../shared/utils/generateEventId.js";

export class TenantService {
    constructor(private readonly tenantRepo: TenantRepository) { }

    /**
     * Assigns a new API key (env_id) to the authenticated tenant.
     * @param {string} id - Tenant UUID (from JWT)
     * @returns {ITenant} Updated tenant with new env_id
     */
    async createApiKey(id: string) {
        const envId = generateEventId();
        const tenant = await this.tenantRepo.assignApiKey({ id, envId });
        if (!tenant) {
            throw new AppError(404, "Tenant not found. Please authenticate first.");
        }
        return tenant;
    }

    /**
     * Retrieves tenant information by their API key (env_id).
     * @param {string} envId - Environment ID / API key
     * @returns {ITenant} Matching tenant
     */
    async getTenant(envId: string) {
        const tenant = await this.tenantRepo.findByEnvId(envId);
        if (!tenant) {
            throw new AppError(404, "Tenant not found");
        }
        return tenant;
    }
}