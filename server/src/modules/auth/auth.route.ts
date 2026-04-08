import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import type { AuthService } from "./auth.service.js";
import { authMiddleware } from "../../shared/middleware/auth.middleware.js";
import { authLimiter } from "../../shared/middleware/rateLimiter.middleware.js";

export function AuthRoutes({ authService }: { authService: AuthService }) {
    const router = Router();
    const authController = new AuthController(authService);

    // Public (no auth required)
    router.get("/google", authLimiter, authController.handleLogin);
    router.get("/google/callback", authController.handleCallback);
    router.get("/demo", authLimiter, authController.handleDemoLogin);
    router.post("/refresh-token", authController.handleRefreshToken);

    // Protected (requires valid access token)
    router.post("/logout", authMiddleware, authController.handleLogout);
    router.get("/me", authMiddleware, authController.handleMe);

    return router;
}
