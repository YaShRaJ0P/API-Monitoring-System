/**
 * Tenant entity - represents a user/organization in the system.
 */
export interface ITenant {
    id: string;
    email: string;
    google_id?: string | undefined;
    name?: string | undefined;
    avatar?: string | undefined;
    refresh_token?: string | undefined;
    is_admin: boolean;
    created_at: Date;
    updated_at: Date;
}

/**
 * Project entity - each tenant can have multiple projects.
 */
export interface IProject {
    id: string;
    api_key: string;
    api_secret: string;
    tenant_id: string;
    name: string;
    created_at: Date;
}
