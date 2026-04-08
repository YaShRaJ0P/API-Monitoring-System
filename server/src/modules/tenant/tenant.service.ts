import { AppError } from "../../shared/errors/AppError.js";
import type { IProject } from "./tenant.entity.js";
import type { TenantRepository } from "./tenant.repository.js";

/**
 * Service layer for project management.
 * Handles business logic for creating and managing projects.
 */
export class TenantService {
    constructor(private readonly tenantRepo: TenantRepository) { }

    /**
     * Creates a new project for the tenant.
     * @param {string} tenantId - Tenant UUID
     * @param {string} name - Project name
     * @returns {Promise<IProject>} Created project
     */
    async createProject(tenantId: string, name: string): Promise<IProject> {
        if (!name || name.trim().length === 0) {
            throw new AppError(400, "Project name is required");
        }
        return this.tenantRepo.createProject(tenantId, name.trim());
    }

    /**
     * Lists all projects for a tenant.
     * @param {string} tenantId - Tenant UUID
     * @returns {Promise<IProject[]>} Array of projects
     */
    async listProjects(tenantId: string): Promise<IProject[]> {
        return this.tenantRepo.listProjects(tenantId);
    }

    /**
     * Deletes a project by id, scoped to tenant.
     * @param {string} id - Project internal UUID
     * @param {string} tenantId - Tenant UUID
     */
    async deleteProject(id: string, tenantId: string) {
        const deleted = await this.tenantRepo.deleteProject(id, tenantId);
        if (!deleted) {
            throw new AppError(404, "Project not found or not owned by you");
        }
    }
}