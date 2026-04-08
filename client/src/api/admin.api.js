import client from "./client";

/**
 * Fetches all tenants for the admin users table.
 * @returns {Promise<Array>} Array of users with project counts
 */
export const getUsers = async () => {
    const { data } = await client.get("/admin/users");
    return data;
};

/**
 * Fetches high-level system stats for the admin overview.
 * @returns {Promise<Object>} { total_users, total_projects, active_alert_rules, outbox, uptime_seconds }
 */
export const getSystemStats = async () => {
    const { data } = await client.get("/admin/users/system-stats");
    return data;
};

/**
 * Deletes a tenant by ID.
 * @param {string} id - Tenant UUID
 * @returns {Promise<Object>}
 */
export const deleteUser = async (id) => {
    const { data } = await client.delete(`/admin/users/${id}`);
    return data;
};

/**
 * Toggles admin status of a tenant.
 * @param {string} id - Tenant UUID
 * @returns {Promise<Object>} Updated user with new is_admin value
 */
export const toggleAdmin = async (id) => {
    const { data } = await client.patch(`/admin/users/${id}/toggle-admin`);
    return data;
};

/**
 * Disconnects RabbitMQ for circuit breaker testing.
 * @returns {Promise<Object>} Response
 */
export const rabbitMqDown = async () => {
    const { data } = await client.post("/admin/rabbitmq/down");
    return data;
};

/**
 * Reconnects RabbitMQ after disconnection.
 * @returns {Promise<Object>} Response
 */
export const rabbitMqUp = async () => {
    const { data } = await client.post("/admin/rabbitmq/up");
    return data;
};

/**
 * Gets the current RabbitMQ connection status.
 * @returns {Promise<{ status: "connected" | "connecting" | "disconnected" }>}
 */
export const getRabbitMqStatus = async () => {
    const { data } = await client.get("/admin/rabbitmq/status");
    return data;
};

/**
 * Gets a combined circuit breaker snapshot: RabbitMQ status, circuit state,
 * Redis buffer counts, and whether simulation mode is active.
 * @returns {Promise<{
 *   rabbitmqStatus: string,
 *   circuitState: "open"|"halfOpen"|"closed"|"unknown",
 *   bufferCount: number,
 *   deadBufferCount: number,
 *   simulationMode: boolean
 * }>}
 */
export const getCircuitStats = async () => {
    const { data } = await client.get("/admin/circuit/stats");
    return data;
};
