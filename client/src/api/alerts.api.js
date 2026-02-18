import client from "./client";

/**
 * Fetches all alert rules for the authenticated tenant.
 * @returns {Promise<Array>} Alert rules
 */
export const getRules = async () => {
    const { data } = await client.get("/alerts");
    return data.data;
};

/**
 * Creates a new alert rule.
 * @param {object} ruleData - Alert rule payload
 * @returns {Promise<object>} Created rule
 */
export const createRule = async (ruleData) => {
    const { data } = await client.post("/alerts", ruleData);
    return data.data;
};

/**
 * Updates an existing alert rule.
 * @param {string} id - Rule UUID
 * @param {object} updates - Partial rule updates
 * @returns {Promise<object>} Updated rule
 */
export const updateRule = async (id, updates) => {
    const { data } = await client.put(`/alerts/${id}`, updates);
    return data.data;
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
 * Fetches paginated alert history for the authenticated tenant.
 * @param {{ page?: number, limit?: number }} params
 * @returns {Promise<{ data: Array, total: number }>}
 */
export const getAlertHistory = async (params = {}) => {
    const { data } = await client.get("/alerts/history", { params });
    return { data: data.data, total: data.total };
};
