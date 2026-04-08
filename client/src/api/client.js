import axios from "axios";
import { config } from "@/config";

/**
 * In-memory access token storage.
 */
let accessToken = null;

/**
 * Sets the in-memory access token.
 * @param {string|null} token
 */
export const setAccessToken = (token) => {
    accessToken = token;
};

/**
 * Returns the current in-memory access token.
 * @returns {string|null}
 */
export const getAccessToken = () => accessToken;

/**
 * Axios instance pre-configured for the API.
 * - Credentials (cookies) sent with every request for refresh-token flow
 */
const client = axios.create({
    baseURL: config.base_uri,
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
});

let refreshTokenPromise = null;

export const executeRefreshToken = () => {
    if (!refreshTokenPromise) {
        refreshTokenPromise = client.post("/auth/refresh-token").finally(() => {
            refreshTokenPromise = null;
        });
    }
    return refreshTokenPromise;
};

// ---- Request Interceptor -------------
// Attaches the in-memory Bearer token to every outgoing request.
client.interceptors.request.use(
    (config) => {
        const token = getAccessToken();

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ---- Response Interceptor ---------------
// On 401, attempts a silent token refresh using the httpOnly refresh cookie.
// If refresh succeeds, retries the original request with the new token.
// If refresh fails, clears the token and redirects to /login.
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

client.interceptors.response.use(
    (response) => {
        if (!response.data.success) {
            return Promise.reject(response.data);
        }
        return response.data;
    },
    async (error) => {
        const originalRequest = error.config;

        // Skip refresh attempts for the refresh endpoint itself
        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url?.includes("/auth/refresh-token")
        ) {
            if (isRefreshing) {
                // Queue requests while a refresh is in-flight
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return client(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Response interceptor already unwraps response payload
                const res = await executeRefreshToken();
                const newToken = res.data?.accessToken;

                if (newToken) {
                    setAccessToken(newToken);
                    processQueue(null, newToken);
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return client(originalRequest);
                }
            } catch (refreshError) {
                processQueue(refreshError, null);
                setAccessToken(null);
                window.location.href = "/login";
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default client;
