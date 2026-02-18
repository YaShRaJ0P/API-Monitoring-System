import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import filtersReducer from "./slices/filtersSlice";

/**
 * Central Redux store.
 * - auth: user session state
 * - filters: global time range, environment, granularity
 */
const store = configureStore({
    reducer: {
        auth: authReducer,
        filters: filtersReducer,
    },
});

export default store;
