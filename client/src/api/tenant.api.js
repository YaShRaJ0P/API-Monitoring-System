import client from "./client";

/**
 * Generates or regenerates an API key for the authenticated tenant.
 * @returns {Promise<string>} The new env_id (API key)
 */
export const generateApiKey = async () => {
    const { data } = await client.post("/tenant/api-key");
    return data.data?.env_id;
};
