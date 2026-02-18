import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getMe, refreshToken, logout as logoutApi } from "../../api/auth.api";
import { setAccessToken } from "../../api/client";

/**
 * Attempts a silent refresh on app load.
 * Uses the httpOnly cookie to get a new access token,
 * then fetches the user profile.
 */
export const initializeAuth = createAsyncThunk(
    "auth/initialize",
    async (_, { rejectWithValue }) => {
        try {
            const token = await refreshToken();
            if (!token) return rejectWithValue("No token received");

            setAccessToken(token);
            const user = await getMe();
            return user;
        } catch {
            setAccessToken(null);
            return rejectWithValue("Session expired");
        }
    }
);

/**
 * Handles the access token received from the OAuth callback redirect.
 * Stores the token in-memory and fetches the user profile.
 */
export const handleOAuthCallback = createAsyncThunk(
    "auth/oauthCallback",
    async (token, { rejectWithValue }) => {
        try {
            setAccessToken(token);
            const user = await getMe();
            return user;
        } catch {
            setAccessToken(null);
            return rejectWithValue("Failed to fetch user profile");
        }
    }
);

/**
 * Logs the user out on the server and clears local state.
 */
export const logoutUser = createAsyncThunk(
    "auth/logout",
    async (_, { rejectWithValue }) => {
        try {
            await logoutApi();
            setAccessToken(null);
        } catch (error) {
            setAccessToken(null);
            return rejectWithValue("Logout failed");
        }
    }
);

const authSlice = createSlice({
    name: "auth",
    initialState: {
        user: null,
        isAuthenticated: false,
        loading: true, // true until initializeAuth resolves
        error: null,
    },
    reducers: {
        /**
         * Clears auth state without an API call (e.g. on token refresh failure).
         */
        clearAuth: (state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.error = null;
        },

        /**
         * Updates the user's env_id after API key generation.
         * @param {object} state
         * @param {{ payload: string }} action - The new env_id
         */
        setEnvId: (state, action) => {
            if (state.user) {
                state.user.env_id = action.payload;
            }
        },
    },
    extraReducers: (builder) => {
        // ── initializeAuth ──
        builder
            .addCase(initializeAuth.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(initializeAuth.fulfilled, (state, action) => {
                state.user = action.payload;
                state.isAuthenticated = true;
                state.loading = false;
            })
            .addCase(initializeAuth.rejected, (state) => {
                state.user = null;
                state.isAuthenticated = false;
                state.loading = false;
            });

        // ── handleOAuthCallback ──
        builder
            .addCase(handleOAuthCallback.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(handleOAuthCallback.fulfilled, (state, action) => {
                state.user = action.payload;
                state.isAuthenticated = true;
                state.loading = false;
            })
            .addCase(handleOAuthCallback.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // ── logoutUser ──
        builder
            .addCase(logoutUser.fulfilled, (state) => {
                state.user = null;
                state.isAuthenticated = false;
                state.loading = false;
            })
            .addCase(logoutUser.rejected, (state) => {
                // Force clear even if API call failed
                state.user = null;
                state.isAuthenticated = false;
                state.loading = false;
            });
    },
});

export const { clearAuth, setEnvId } = authSlice.actions;
export default authSlice.reducer;
