/**
 * Structured Logger
 * 
 * Provides consistent, structured JSON logging across the application.
 * Supports log levels: debug, info, warn, error.
 * In production, debug logs are suppressed.
 */

import { config } from "../../config/config";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: string;
    data?: unknown;
    error?: string;
    stack?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel: LogLevel = (config.LOG_LEVEL as LogLevel) || (config.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatEntry(entry: LogEntry): string {
    if (config.NODE_ENV === "production") {
        return JSON.stringify(entry);
    }

    // Dev-friendly format with color
    const colors: Record<LogLevel, string> = {
        debug: "\x1b[36m",  // Cyan
        info: "\x1b[32m",   // Green
        warn: "\x1b[33m",   // Yellow
        error: "\x1b[31m",  // Red
    };
    const reset = "\x1b[0m";
    const color = colors[entry.level];

    const ctx = entry.context ? ` [${entry.context}]` : "";
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
    const errStr = entry.error ? ` | Error: ${entry.error}` : "";

    return `${color}${entry.level.toUpperCase().padEnd(5)}${reset} ${entry.timestamp}${ctx} ${entry.message}${dataStr}${errStr}`;
}

function createEntry(level: LogLevel, message: string, context?: string, data?: unknown, error?: Error): LogEntry {
    const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
    };

    if (context) entry.context = context;
    if (data) entry.data = data;
    if (error) {
        entry.error = error.message;
        if (error.stack) {
            entry.stack = error.stack;
        }
    }

    return entry;
}

function log(level: LogLevel, message: string, context?: string, data?: unknown, error?: Error): void {
    if (!shouldLog(level)) return;

    const entry = createEntry(level, message, context, data, error);
    const formatted = formatEntry(entry);

    switch (level) {
        case "debug":
            console.debug(formatted);
            break;
        case "info":
            console.info(formatted);
            break;
        case "warn":
            console.warn(formatted);
            break;
        case "error":
            console.error(formatted);
            if (entry.stack && config.NODE_ENV !== "production") {
                console.error(entry.stack);
            }
            break;
    }
}

/**
 * Creates a named logger instance with a fixed context.
 * 
 * @example
 * 
 * const log = createLogger("RabbitMQ");
 * 
 */
export function createLogger(context: string) {
    return {
        debug: (message: string, data?: unknown) =>
            log("debug", message, context, data),

        info: (message: string, data?: unknown) =>
            log("info", message, context, data),

        warn: (message: string, data?: unknown) =>
            log("warn", message, context, data),

        error: (message: string, data?: unknown, error?: Error) =>
            log("error", message, context, data, error),
    };
}

/**
 * Global logger (no context prefix).
 */
export const logger = {
    debug: (message: string, data?: unknown) =>
        log("debug", message, undefined, data),

    info: (message: string, data?: unknown) =>
        log("info", message, undefined, data),

    warn: (message: string, data?: unknown) =>
        log("warn", message, undefined, data),

    error: (message: string, data?: unknown, error?: Error) =>
        log("error", message, undefined, data, error),
};
