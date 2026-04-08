import client from "./client";

/**
 * Creates a new project for the tenant.
 * @param {string} name - Project name
 * @returns {Promise<object>} Created project with id
 */
export const createProject = async (name) => {
    const res = await client.post("/tenant", { name });
    return res.data;
};

/**
 * Lists all projects for the authenticated tenant.
 * @returns {Promise<object[]>} Array of projects
 */
export const listProjects = async () => {
    const res = await client.get("/tenant");
    return res.data;
};

/**
 * Deletes a project by its id.
 * @param {string} envId - Project API key
 * @returns {Promise<void>}
 */
export const deleteProject = async (envId) => {
    await client.delete(`/tenant/${envId}`);
};
