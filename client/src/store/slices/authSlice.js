import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getMe, refreshToken, logout as logoutApi } from "../../api/auth.api";
import { setAccessToken } from "../../api/client";
import { listProjects } from "../../api/tenant.api";

/**
 * Attempts a silent refresh on app load.
 * Fetches user profile and their projects.
 */
export const initializeAuth = createAsyncThunk(
    "auth/initialize",
    async (_, { rejectWithValue }) => {
        try {
            const token = await refreshToken();
            if (!token) return rejectWithValue("No token received");

            setAccessToken(token);
            const user = await getMe();
            const projects = await listProjects();
            return { user, projects };
        } catch (error) {
            setAccessToken(null);
            return rejectWithValue("Session expired");
        }
    }
);

/**
 * Handles the access token received from the OAuth callback redirect.
 * Stores the token and fetches user profile + projects.
 */
export const handleOAuthCallback = createAsyncThunk(
    "auth/oauthCallback",
    async (token, { rejectWithValue }) => {
        try {

            setAccessToken(token);
            const user = await getMe();
            const projects = await listProjects();
            return { user, projects };
        } catch(error) {
            setAccessToken(null);
            return rejectWithValue("Failed to fetch user profile");
        }
    }
);

/**
 * Logs the user out and clears local state.
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
        projects: [],
        activeProjectId: null,
        isAuthenticated: false,
        loading: true,
        error: null,
    },
    reducers: {
        /**
         * Clears auth state without an API call.
         */
        clearAuth: (state) => {
            state.user = null;
            state.projects = [];
            state.activeProjectId = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.error = null;
        },

        /**
         * Sets the projects list (after create/delete).
         * @param {{ payload: object[] }} action - Array of projects
         */
        setProjects: (state, action) => {
            state.projects = action.payload;
            if (state.projects.length > 0 && !state.activeProjectId) {
                state.activeProjectId = state.projects[0].id;
            }
            if (state.projects.length === 0) {
                state.activeProjectId = null;
            }
        },

        /**
         * Switches the active project.
         * @param {{ payload: string }} action - Project id
         */
        setActiveProject: (state, action) => {
            state.activeProjectId = action.payload;
        },
    },
    extraReducers: (builder) => {
        // -- initializeAuth --
        builder
            .addCase(initializeAuth.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(initializeAuth.fulfilled, (state, action) => {
                state.user = action.payload.user;
                state.projects = action.payload.projects;
                if (action.payload.projects.length > 0 && !state.activeProjectId) {
                    state.activeProjectId = action.payload.projects[0].id;
                }
                state.isAuthenticated = true;
                state.loading = false;
            })
            .addCase(initializeAuth.rejected, (state) => {
                state.user = null;
                state.projects = [];
                state.activeProjectId = null;
                state.isAuthenticated = false;
                state.loading = false;
            });

        // -- handleOAuthCallback --
        builder
            .addCase(handleOAuthCallback.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(handleOAuthCallback.fulfilled, (state, action) => {
                state.user = action.payload.user;
                state.projects = action.payload.projects;
                if (action.payload.projects.length > 0 && !state.activeProjectId) {
                    state.activeProjectId = action.payload.projects[0].id;
                }
                state.isAuthenticated = true;
                state.loading = false;
            })
            .addCase(handleOAuthCallback.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // -- logoutUser --
        builder
            .addCase(logoutUser.fulfilled, (state) => {
                state.user = null;
                state.projects = [];
                state.activeProjectId = null;
                state.isAuthenticated = false;
                state.loading = false;
            })
            .addCase(logoutUser.rejected, (state) => {
                state.user = null;
                state.projects = [];
                state.activeProjectId = null;
                state.isAuthenticated = false;
                state.loading = false;
            });
    },
});

export const { clearAuth, setProjects, setActiveProject } = authSlice.actions;
export default authSlice.reducer;
