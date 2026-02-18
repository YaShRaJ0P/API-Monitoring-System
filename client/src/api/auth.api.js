import client from "./client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

/**
 * Returns the full Google OAuth login URL on the server.
 * The browser navigates here to start the OAuth flow.
 * @returns {string} Google OAuth initiation URL
 */
export const getGoogleOAuthUrl = () => `${API_URL}/auth/google`;

/**
 * Fetches the authenticated user's profile.
 * @returns {Promise<object>} User profile data
 */
export const getMe = async () => {
    const { data } = await client.get("/auth/me");
    return data.data;
};

/**
 * Requests a new access token using the httpOnly refresh cookie.
 * @returns {Promise<string>} New access token
 */
export const refreshToken = async () => {
    const { data } = await client.post("/auth/refresh-token");
    return data.data?.accessToken;
};

/**
 * Logs the user out on the server and clears the refresh cookie.
 * @returns {Promise<void>}
 */
export const logout = async () => {
    await client.post("/auth/logout");
};
