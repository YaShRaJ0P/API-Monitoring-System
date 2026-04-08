import client from "./client";

/**
 * Fetches paginated list of failed DLQ (Dead Letter Queue) entries.
 * @param {{ page?: number, limit?: number }} params
 * @returns {Promise<{ data: Array, total: number, totalPages: number }>}
 */
export const getDlqEntries = async (params = {}) => {
    const { data } = await client.get("/admin/dlq", { params });
    return { data: data.data, total: data.total, totalPages: data.totalPages, page: data.page };
};

/**
 * Fetches outbox status counts (pending, processed, failed, total).
 * @returns {Promise<{ pending: number, processed: number, failed: number, total: number }>}
 */
export const getDlqStats = async () => {
    const { data } = await client.get("/admin/dlq/stats");
    return data;
};

/**
 * Replays a single failed DLQ entry by resetting it to pending.
 * @param {string} id - event_id (UUID) of the outbox entry
 * @returns {Promise<void>}
 */
export const replayDlqEntry = async (id) => {
    const { data } = await client.post(`/admin/dlq/replay/${id}`);
    return data;
};

/**
 * Replays all failed DLQ entries.
 * @returns {Promise<{ message: string }>}
 */
export const replayAllDlq = async () => {
    const { data } = await client.post("/admin/dlq/replay-all");
    return data;
};
