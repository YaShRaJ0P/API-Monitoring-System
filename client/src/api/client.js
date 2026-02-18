import axios from "axios";

/**
 * In-memory access token storage.
 * Kept outside of Redux to avoid circular dependencies
 * (interceptors need the token but shouldn't import the store).
 */
let accessToken = null;

/**
 * Sets the in-memory access token.
 * @param {string|null} token - JWT access token
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
 * - BaseURL from env or defaults to localhost:3000
 * - Credentials (cookies) sent with every request
 */
const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1",
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
});

// ─── Request Interceptor ─────────────────────────────────
// Attaches the Bearer token to every outgoing request.
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

// ─── Response Interceptor ────────────────────────────────
// On 401, attempts a silent token refresh using the httpOnly cookie.
// If refresh succeeds, retries the original request.
// If refresh fails, redirects to /login.
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
    (response) => response,
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
                const { data } = await client.post("/auth/refresh-token");
                const newToken = data.data?.accessToken;

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
