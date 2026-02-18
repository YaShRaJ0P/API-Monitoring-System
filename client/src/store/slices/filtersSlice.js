import { createSlice } from "@reduxjs/toolkit";
import { subHours, formatISO } from "date-fns";

/**
 * Predefined time range options.
 * Each has a label and a function to compute the start date.
 */
export const TIME_RANGES = {
    "1h": { label: "Last 1 hour", hours: 1 },
    "6h": { label: "Last 6 hours", hours: 6 },
    "24h": { label: "Last 24 hours", hours: 24 },
    "7d": { label: "Last 7 days", hours: 168 },
    "30d": { label: "Last 30 days", hours: 720 },
};

/**
 * Computes ISO date strings for a given time range key.
 * @param {string} rangeKey - One of the TIME_RANGES keys
 * @returns {{ startDate: string, endDate: string }}
 */
export function computeDateRange(rangeKey) {
    const now = new Date();
    const hours = TIME_RANGES[rangeKey]?.hours || 24;
    return {
        startDate: formatISO(subHours(now, hours)),
        endDate: formatISO(now),
    };
}

const filtersSlice = createSlice({
    name: "filters",
    initialState: {
        timeRange: "24h",
        environment: "all",
        granularity: "1h",
    },
    reducers: {
        /**
         * Sets the active time range key (e.g. "1h", "24h", "7d").
         * @param {object} state
         * @param {{ payload: string }} action
         */
        setTimeRange: (state, action) => {
            state.timeRange = action.payload;

            // Auto-adjust granularity based on range
            const hours = TIME_RANGES[action.payload]?.hours || 24;
            if (hours <= 1) state.granularity = "1m";
            else if (hours <= 6) state.granularity = "5m";
            else if (hours <= 24) state.granularity = "15m";
            else if (hours <= 168) state.granularity = "1h";
            else state.granularity = "1d";
        },

        /**
         * Sets the active environment filter.
         * @param {object} state
         * @param {{ payload: string }} action
         */
        setEnvironment: (state, action) => {
            state.environment = action.payload;
        },

        /**
         * Sets the granularity override.
         * @param {object} state
         * @param {{ payload: string }} action
         */
        setGranularity: (state, action) => {
            state.granularity = action.payload;
        },
    },
});

export const { setTimeRange, setEnvironment, setGranularity } = filtersSlice.actions;
export default filtersSlice.reducer;
