import cors from "cors"
import express from "express"
import session from "express-session"
import cookieParser from "cookie-parser"
import passport from "passport"
import { config } from "./config/config.js"
import helmet from "helmet"
import response from "./shared/utils/response.js"
import { AuthRoutes } from "./modules/auth/auth.route.js"
import { IngestionRouter } from "./modules/ingestion/ingestion.route.js"
import { TenantRoutes } from "./modules/tenant/tenant.route.js"
import { MetricsRoutes } from "./modules/metrics/metrics.route.js"
import { AlertRoutes } from "./modules/alerts/alerts.route.js"
import { DLQRoutes } from "./modules/dlq/dlq.route.js"
import { AdminRoutes } from "./modules/admin/admin.route.js"
import configurePassport from "./modules/auth/passport.js"
import { AuthRepository } from "./modules/auth/auth.repository.js"
import { AuthService } from "./modules/auth/auth.service.js"
import { DataBaseConfig, MongoDB, PostgreSQL, Redis } from "./config/db/index.js"
import { RabbitMQ } from "./config/rabbitmq.js"
import { errorMiddleware } from "./shared/middleware/error.middleware.js"
import { authMiddleware } from "./shared/middleware/auth.middleware.js"
import { isAdminMiddleware } from "./shared/middleware/isAdmin.middleware.js"
import { apiKeyMiddleware } from "./shared/middleware/apiKey.middleware.js"
import { globalLimiter } from "./shared/middleware/rateLimiter.middleware.js"
import { apiKeyLimiter } from "./shared/middleware/apiKeyRateLimit.middleware.js"

/**
 * Creates and configures the Express application.
 */
export function createApp() {
    const app = express();
    app.set("trust proxy", 1);

    // ------ Core Middleware ------
    app.use(cors(config.cors))
    app.use(express.json({ limit: "10mb" }))
    app.use(express.urlencoded({ extended: true, limit: "10mb" }))
    app.use(helmet())
    app.use(cookieParser())
    app.use(globalLimiter)

    // Session middleware
    app.use(session({
        secret: config.session.secret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: config.NODE_ENV === "production",
            sameSite: config.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 1000 * 60 * 60 * 24 * 7,
        }
    }))

    app.use(passport.initialize())
    app.use(passport.session())

    const pool = DataBaseConfig.getPostgresPool();
    const authRepo = new AuthRepository(pool);
    const authService = new AuthService(authRepo);
    configurePassport(passport, authService, authRepo);


    // ------ Public routes ------
    app.get("/", (req, res) => {
        response(res, 200, "API Monitoring System", null)
    })

    app.get("/health", async (req, res) => {
        const checks: Record<string, string> = {};
        let allHealthy = true;

        // PostgreSQL
        try {
            const pgStatus = await PostgreSQL.getStatus();
            checks.postgres = pgStatus;
            if (pgStatus !== "connected") allHealthy = false;
        } catch {
            checks.postgres = "disconnected";
            allHealthy = false;
        }

        // MongoDB
        checks.mongo = MongoDB.getStatus();
        if (checks.mongo !== "connected") allHealthy = false;

        // Redis
        checks.redis = Redis.getStatus();
        if (checks.redis !== "connected") allHealthy = false;

        // RabbitMQ
        checks.rabbitmq = RabbitMQ.getStatus();
        if (checks.rabbitmq !== "connected") allHealthy = false;

        const statusCode = allHealthy ? 200 : 503;
        response(res, statusCode, allHealthy ? "All services healthy" : `
            Postgres : ${checks.postgres.toUpperCase()}
            MongoDB : ${checks.mongo.toUpperCase()}
            Redis : ${checks.redis.toUpperCase()}
            RabbitMQ : ${checks.rabbitmq.toUpperCase()}
            `, {
            status: allHealthy ? "healthy" : "degraded",
            services: checks,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    })

    // Auth routes
    app.use(config.api.prefix + "/" + config.api.version + "/auth", AuthRoutes({ authService }))

    // ------ Protected routes ------
    app.use(config.api.prefix + "/" + config.api.version + "/tenant", authMiddleware, TenantRoutes({ postgresPool: pool }))
    app.use(config.api.prefix + "/" + config.api.version + "/ingest", apiKeyMiddleware, apiKeyLimiter, IngestionRouter())
    app.use(config.api.prefix + "/" + config.api.version + "/metrics", authMiddleware, MetricsRoutes({ postgresPool: pool }))
    app.use(config.api.prefix + "/" + config.api.version + "/alerts", authMiddleware, AlertRoutes())
    app.use(config.api.prefix + "/" + config.api.version + "/admin/dlq", authMiddleware, isAdminMiddleware, DLQRoutes({ postgresPool: pool }))
    app.use(config.api.prefix + "/" + config.api.version + "/admin", authMiddleware, isAdminMiddleware, AdminRoutes())

    // ------ Error handler
    app.use(errorMiddleware)

    return app;
}