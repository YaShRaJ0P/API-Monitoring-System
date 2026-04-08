import client from "./client";

/**
 * Fetches all alert rules for a project.
 * @param {string} projectId - Project id
 * @returns {Promise<Array>} Alert rules array
 */
export const getRules = async (projectId) => {
    const res = await client.get("/alerts", { params: { project_id: projectId } });
    return res.data;
};

/**
 * Creates a new alert rule for a project.
 * @param {object} ruleData - Alert rule payload
 * @returns {Promise<object>} Created rule
 */
export const createRule = async (ruleData) => {
    const res = await client.post("/alerts", ruleData);
    return res.data;
};

/**
 * Updates an existing alert rule.
 * @param {string} id - Rule UUID
 * @param {object} updates - Partial rule updates
 * @returns {Promise<object>} Updated rule
 */
export const updateRule = async (id, updates) => {
    const res = await client.put(`/alerts/${id}`, updates);
    return res.data;
};

/**
 * Deletes an alert rule.
 * @param {string} id - Rule UUID
 * @returns {Promise<void>}
 */
export const deleteRule = async (id) => {
    await client.delete(`/alerts/${id}`);
};

/**
 * Manually resolves an active alert rule incident.
 * @param {string} id - Rule UUID
 * @returns {Promise<object>}
 */
export const resolveRule = async (id) => {
    const res = await client.post(`/alerts/${id}/resolve`);
    return res.data;
};

/**
 * Fetches paginated alert history for a project.
 * @param {string} projectId - Project id
 * @param {{ page?: number, limit?: number }} params
 * @returns {Promise<{ data: Array, total: number }>}
 */
export const getAlertHistory = async (projectId, params = {}) => {
    const res = await client.get("/alerts/history", {
        params: { project_id: projectId, ...params },
    });
    return res.data;
};
