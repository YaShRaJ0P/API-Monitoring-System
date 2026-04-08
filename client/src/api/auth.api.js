import client, { executeRefreshToken } from "./client";
import { config } from "@/config";

/**
 * Returns the full Google OAuth login URL on the server.
 * The browser navigates here to start the OAuth flow.
 * @returns {string} Google OAuth initiation URL
 */
export const getGoogleOAuthUrl = () => `${config.base_uri}/auth/google`;
export const getDemoLoginUrl = () => `${config.base_uri}/auth/demo`;

/**
 * Fetches the authenticated user's profile.
 * @returns {Promise<object>} User profile data
 */
export const getMe = async () => {
    const res = await client.get("/auth/me");
    return res.data;
};

/**
 * Requests a new access token using the httpOnly refresh cookie.
 * @returns {Promise<string>} New access token
 */
export const refreshToken = async () => {
    const res = await executeRefreshToken();
    return res.data?.accessToken;
};

/**
 * Logs the user out on the server and clears the refresh cookie.
 * @returns {Promise<void>}
 */
export const logout = async () => {
    await client.post("/auth/logout");
};
