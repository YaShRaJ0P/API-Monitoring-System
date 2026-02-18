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
import { alertsRouter } from "./modules/alerts/alerts.route.js"
import { dlqRouter } from "./modules/dlq/dlq.route.js"
import configurePassport from "./modules/auth/passport.js"
import { AuthRepository } from "./modules/auth/auth.repository.js"
import { AuthService } from "./modules/auth/auth.service.js"
import { DataBaseConfig, MongoDB, PostgreSQL, Redis } from "./config/db/index.js"
import { RabbitMQ } from "./config/rabbitmq.js"
import { errorMiddleware } from "./shared/middleware/error.middleware.js"
import { authMiddleware } from "./shared/middleware/auth.middleware.js"
import { globalLimiter, authLimiter, ingestLimiter } from "./shared/middleware/rateLimiter.middleware.js"

/**
 * Creates and configures the Express application.
 */
export function createApp() {
    const app = express();

    // ───── Core Middleware ─────
    app.use(cors(config.cors))
    app.use(express.json({ limit: "10mb" }))
    app.use(express.urlencoded({ extended: true, limit: "10mb" }))
    app.use(helmet())
    app.use(cookieParser())
    app.use(globalLimiter)

    // Session middleware for passport (uses dedicated session secret)
    app.use(session({
        secret: config.session.secret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: config.NODE_ENV === "production",
            maxAge: 1000 * 60 * 60 * 24 * 7,
        }
    }))

    app.use(passport.initialize())
    app.use(passport.session())

    // ───── Shared DI — single instances used by both Passport and Auth routes ─────
    const pool = DataBaseConfig.getPostgresPool();
    const authRepo = new AuthRepository(pool);
    const authService = new AuthService(authRepo);
    configurePassport(passport, authService, authRepo);


    // ───── Public routes ─────
    app.get("/", (req, res) => {
        response(res, 200, "Hello World!", null)
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
        response(res, statusCode, allHealthy ? "All services healthy" : "Some services are unhealthy", {
            status: allHealthy ? "healthy" : "degraded",
            services: checks,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    })

    // Auth routes (login, callback are public; me/refresh/logout use auth middleware inside)
    app.use(config.api.prefix + "/" + config.api.version + "/auth", authLimiter, AuthRoutes({ authService }))

    // ───── Protected routes ─────
    app.use(config.api.prefix + "/" + config.api.version + "/tenant", authMiddleware, TenantRoutes({ postgresPool: pool }))
    app.use(config.api.prefix + "/" + config.api.version + "/ingest", authMiddleware, ingestLimiter, IngestionRouter())
    app.use(config.api.prefix + "/" + config.api.version + "/metrics", authMiddleware, MetricsRoutes({ postgresPool: pool }))
    app.use(config.api.prefix + "/" + config.api.version + "/alerts", authMiddleware, alertsRouter)
    app.use(config.api.prefix + "/" + config.api.version + "/admin/dlq", authMiddleware, dlqRouter)

    // ───── Error handler (MUST be last) ─────
    app.use(errorMiddleware)

    return app;
}
