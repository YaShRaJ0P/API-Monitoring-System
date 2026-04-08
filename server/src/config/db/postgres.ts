import pkg from "pg";
const { Pool } = pkg;
import { config } from "../config.js";
import { AppError } from "../../shared/errors/AppError.js";
import { createLogger } from "../../shared/utils/logger.js";
import fs from "fs";
import path from "path";


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
            log.error("PostgreSQL URI is not defined");
            throw new AppError(500, "Internal Server Error");
        }

        try {

            // Verify connection and setup schema
            const sqlPath = path.join(process.cwd(), "scripts/schema.sql");

            if (!fs.existsSync(sqlPath)) {
                log.error(`Schema file missing: ${sqlPath}`);
                throw new AppError(500, "Internal Server Error");
            }

            const sql = fs.readFileSync(sqlPath, "utf8");

            this.pool = new Pool({
                connectionString: uri,
                ssl: config.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
            });

            await this.pool.query("SELECT 1");
            await this.pool.query(sql);

            log.info("PostgreSQL connected and schema verified");
            return this.pool;
        } catch (error) {
            log.error("PostgreSQL connection failed", undefined, error instanceof Error ? error : undefined);
            throw new AppError(500, "PostgreSQL connection failed", error);
        }
    }

    /**
     * Returns the active PostgreSQL pool.
     * @returns {Pool} pg Pool instance
     * @throws {AppError} 500 if not yet initialized
     */
    static getPool(): pkg.Pool {
        if (!this.pool) {
            log.error("PostgreSQL not initialized");
            throw new AppError(500, "Internal Server Error");
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
        if (!this.pool) {
            log.error("PostgreSQL not initialized");
            return "disconnected";
        }
        try {
            await this.pool.query("SELECT 1");
            return "connected";
        } catch {
            log.error("PostgreSQL connection failed");
            return "disconnected";
        }
    }
}
