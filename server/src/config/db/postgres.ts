import pkg from "pg";
const { Pool } = pkg;
import { config } from "../config.js";
import { AppError } from "../../shared/errors/AppError.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("PostgreSQL");

/**
 * PostgreSQL singleton connection manager.
 * Uses pg Pool with connection pooling and auto-schema setup.
 */
export class PostgreSQL {
    private static pool: pkg.Pool | null = null;

    /**
     * Establishes a PostgreSQL connection pool and initializes the schema.
     * @returns {Promise<Pool>} pg Pool instance
     * @throws {AppError} 500 if URI is missing or connection fails
     */
    static async connect(): Promise<pkg.Pool> {
        if (this.pool) {
            return this.pool;
        }

        const uri = config.db.postgres.uri;

        if (!uri) {
            throw new AppError(500, "PostgreSQL URI is not defined");
        }

        try {
            this.pool = new Pool({
                connectionString: uri,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
            });

            // Verify connection and setup schema
            await this.setupSchema();

            log.info("PostgreSQL connected and schema verified");
            return this.pool;
        } catch (error) {
            log.error("PostgreSQL connection failed", undefined, error instanceof Error ? error : undefined);
            throw new AppError(500, "PostgreSQL connection failed", error);
        }
    }

    /**
     * Creates required tables and indexes if they don't exist.
     * @returns {Promise<void>}
     */
    private static async setupSchema(): Promise<void> {
        if (!this.pool) return;

        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS tenants (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                google_id VARCHAR(255) UNIQUE,
                name VARCHAR(255),
                avatar TEXT,
                env_id UUID UNIQUE DEFAULT gen_random_uuid(),
                refresh_token TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS minute_metrics (
                tenant_id UUID NOT NULL,
                service VARCHAR(255) NOT NULL,
                environment VARCHAR(255) NOT NULL,
                endpoint VARCHAR(255) NOT NULL,
                method VARCHAR(10) NOT NULL DEFAULT 'GET',
                minute_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
                total_requests INT DEFAULT 0,
                success_count INT DEFAULT 0,
                failure_count INT DEFAULT 0,
                total_latency BIGINT DEFAULT 0,
                min_latency INT DEFAULT 0,
                max_latency INT DEFAULT 0,
                PRIMARY KEY (tenant_id, service, environment, endpoint, method, minute_bucket)
            );

            CREATE TABLE IF NOT EXISTS hourly_metrics (
                tenant_id UUID NOT NULL,
                service VARCHAR(255) NOT NULL,
                environment VARCHAR(255) NOT NULL,
                endpoint VARCHAR(255) NOT NULL,
                method VARCHAR(10) NOT NULL DEFAULT 'GET',
                hour_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
                total_requests INT DEFAULT 0,
                success_count INT DEFAULT 0,
                failure_count INT DEFAULT 0,
                total_latency BIGINT DEFAULT 0,
                min_latency INT DEFAULT 0,
                max_latency INT DEFAULT 0,
                PRIMARY KEY (tenant_id, service, environment, endpoint, method, hour_bucket)
            );

            CREATE INDEX IF NOT EXISTS idx_minute_metrics_cleanup ON minute_metrics(minute_bucket);
            CREATE INDEX IF NOT EXISTS idx_metrics_service_env ON minute_metrics(service, environment);
            CREATE INDEX IF NOT EXISTS idx_metrics_endpoint ON minute_metrics(endpoint, method);

            -- Alert Rules Table
            CREATE TABLE IF NOT EXISTS alert_rules (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                name VARCHAR(255) NOT NULL,
                metric VARCHAR(50) NOT NULL, -- 'error_rate', 'latency', 'request_count'
                condition VARCHAR(10) NOT NULL, -- '>', '<'
                threshold FLOAT NOT NULL,
                window_minutes INT NOT NULL DEFAULT 5,
                cooldown_minutes INT NOT NULL DEFAULT 60,
                silence_until TIMESTAMP WITH TIME ZONE,
                enabled BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);

            -- Alert History Table
            CREATE TABLE IF NOT EXISTS alert_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
                tenant_id UUID NOT NULL,
                metric_value FLOAT NOT NULL,
                triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_alert_history_tenant ON alert_history(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id);
        `);
    }

    /**
     * Returns the active PostgreSQL pool.
     * @returns {Pool} pg Pool instance
     * @throws {AppError} 500 if not yet initialized
     */
    static getPool(): pkg.Pool {
        if (!this.pool) {
            throw new AppError(500, "PostgreSQL not initialized. Call connect() first.");
        }
        return this.pool;
    }

    /**
     * Disconnects the PostgreSQL pool and releases all connections.
     * @returns {Promise<void>}
     * @throws {AppError} 500 if disconnection fails
     */
    static async disconnect(): Promise<void> {
        try {
            if (this.pool) {
                await this.pool.end();
                this.pool = null;
                log.info("PostgreSQL disconnected");
            }
        } catch (error) {
            log.error("PostgreSQL disconnection failed", undefined, error instanceof Error ? error : undefined);
            throw new AppError(500, "PostgreSQL disconnection failed", error);
        }
    }

    /**
     * Returns the current connection status.
     * @returns {Promise<"connected" | "disconnected">}
     */
    static async getStatus(): Promise<"connected" | "disconnected"> {
        if (!this.pool) return "disconnected";
        try {
            await this.pool.query("SELECT 1");
            return "connected";
        } catch {
            return "disconnected";
        }
    }
}
