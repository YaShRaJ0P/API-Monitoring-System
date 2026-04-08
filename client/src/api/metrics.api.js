import client from "./client";

/**
 * Fetches the metrics overview (summary stats).
 * @param {object} params - Query params (e.g. { range: '24h' })
 * @returns {Promise<object>} Overview data
 */
export const getOverview = async (params = {}) => {
    const res = await client.get("/metrics/overview", { params });
    return res.data;
};

/**
 * Fetches time-series metrics for charting.
 * @param {object} params - Query params (e.g. { range: '24h', granularity: '1h' })
 * @returns {Promise<Array>} Timeseries data points
 */
export const getTimeseries = async (params = {}) => {
    const res = await client.get("/metrics/timeseries", { params });
    return res.data;
};

/**
 * Fetches per-endpoint metrics.
 * @param {object} params - Query params
 * @returns {Promise<Array>} Endpoint metrics
 */
export const getEndpoints = async (params = {}) => {
    const res = await client.get("/metrics/endpoints", { params });
    return res.data;
};

/**
 * Fetches per-service metrics.
 * @param {object} params - Query params
 * @returns {Promise<Array>} Service metrics
 */
export const getServices = async (params = {}) => {
    const res = await client.get("/metrics/services", { params });
    return res.data;
};

/**
 * Fetches raw telemetry logs.
 * @param {object} params - Query params (e.g. { page: 1, limit: 50 })
 * @returns {Promise<Array>} Log entries
 */
export const getLogs = async (params = {}) => {
    const res = await client.get("/metrics/logs", { params });
    return res.data;
};
