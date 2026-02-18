import dotenv from "dotenv";

dotenv.config();

/**
 * Central application configuration.
 * Reads from environment variables with sensible defaults.
 */
export const config = {

    port: process.env.PORT || 3000,
    client_uri: process.env.CLIENT_URI || "http://localhost:5173",
    NODE_ENV: process.env.NODE_ENV || "development",

    cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:5173",
        credentials: true,
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    },

    db: {
        mongo: {
            uri: process.env.MONGODB_URI,
        },
        postgres: {
            uri: process.env.POSTGRES_URI,
        },
        redis: {
            uri: process.env.REDIS_URI,
        },
        rabbitmq: {
            uri: process.env.RABBITMQ_URI || "amqp://localhost",
        }
    },

    jwt: {
        access_token_secret: process.env.ACCESS_TOKEN_SECRET,
        refresh_token_secret: process.env.REFRESH_TOKEN_SECRET,
        access_token_expiry: process.env.ACCESS_TOKEN_EXPIRY || "1d",
        refresh_token_expiry: process.env.REFRESH_TOKEN_EXPIRY || "7d"
    },

    session: {
        secret: process.env.SESSION_SECRET || "fallback-dev-session-secret",
    },

    auth: {
        google: {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            callback_url: process.env.GOOGLE_CALLBACK_URL
        },
    },

    api: {
        prefix: "/api",
        version: "v1"
    }
}