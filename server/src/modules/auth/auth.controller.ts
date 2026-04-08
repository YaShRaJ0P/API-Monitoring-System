import type { NextFunction, Request, Response } from "express";
import response from "../../shared/utils/response.js";
import passport from "passport";
import { config } from "../../config/config.js";
import { AuthService } from "./auth.service.js";
import type { AuthRequest } from "../../shared/types/auth.types.js";
import { AppError } from "../../shared/errors/AppError.js";
import { verifyRefreshToken } from "../../shared/utils/jwt.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("AuthController");

/**
 * Controller for authentication routes.
 * Handles Google OAuth flows, token refresh, logout, and user profile.
 */
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    /**
     * Initiates Google OAuth login flow.
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    handleLogin = async (req: Request, res: Response, next: NextFunction) => {
        passport.authenticate("google", { scope: ["profile", "email"], accessType: "offline", prompt: "consent" })(req, res, next);
    }

    /**
     * Handles Google OAuth callback after user grants permission.
     * Sets refresh token cookie and redirects to client.
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    handleCallback = async (req: Request, res: Response, next: NextFunction) => {
        passport.authenticate("google", {
            failureRedirect: `${config.client_uri}/login?error=auth_failed`,
            session: true,
        }, async (err: any, user: any) => {
            if (err || !user) {
                log.error("Google authentication failed", undefined, err instanceof Error ? err : undefined);
                return res.redirect(`${config.client_uri}/login?error=auth_failed`);
            }

            try {
                const { refreshToken, accessToken } = await this.authService.googleCallback(user.id);

                res.cookie("refreshToken", refreshToken, {
                    httpOnly: true,
                    secure: config.NODE_ENV === "production",
                    sameSite: "strict",
                    maxAge: 1000 * 60 * 60 * 24 * 7,
                });

                log.info(`Authentication successful for user: ${user.id}`);
                res.redirect(`${config.client_uri}/login/success?accessToken=${accessToken}`);
            } catch (error) {
                next(error);
            }
        })(req, res, next);
    }

    /**
     * Handles instant Demo Account login.
     * Sets refresh token cookie and redirects to client as an admin user.
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    handleDemoLogin = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { refreshToken, accessToken } = await this.authService.handleDemoLogin();

            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: config.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 1000 * 60 * 60 * 24 * 7,
            });

            log.info(`Demo login successful - Redirecting to app dashboard`);
            res.redirect(`${config.client_uri}/login/success?accessToken=${accessToken}`);
        } catch (error) {
            log.error("Demo login failed internally", undefined, error instanceof Error ? error : undefined);
            next(error);
        }
    }

    /**
     * Logs user out: clears refresh token, session, and cookies.
     * @param {AuthRequest} req - Express request with authenticated user ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    handleLogout = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as AuthRequest).id;
            if (userId) {
                await this.authService.logout(userId);
            }

            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: config.NODE_ENV === "production",
                sameSite: 'strict',
            });

            // If session exists, destroy it and call passport logout
            if (req.session) {
                req.session.destroy((err) => {
                    if (err) {
                        log.error("Error destroying session", undefined, err);
                        return response(res, 500, "Failed to logout", null);
                    }

                    req.logout((logoutErr) => {
                        if (logoutErr) {
                            return next(logoutErr);
                        }
                        log.info(`User logged out: ${userId}`);
                        response(res, 200, "Logged out successfully", null);
                    });
                });
            } else {
                // No session (stateless JWT-only flow)
                log.info(`User logged out (no session): ${userId}`);
                response(res, 200, "Logged out successfully", null);
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Returns current authenticated user profile.
     * @param {AuthRequest} req - Express request with authenticated user ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function
     */
    handleMe = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as AuthRequest).id;
            if (!userId) {
                throw new AppError(401, "Unauthorized");
            }
            const user = await this.authService.getMe(userId);
            response(res, 200, "OK", user);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Refreshes access token using the httpOnly refresh token cookie.
     * Does NOT require a valid access token - reads from cookie instead.
     */
    handleRefreshToken = async (req: Request, res: Response, next: NextFunction) => {
        try {

            const token = req.cookies?.refreshToken as string | undefined;

            if (!token) {
                throw new AppError(401, "Refresh token not found");
            }

            // Verify the refresh token and extract user ID
            let decoded: { id: string };
            try {
                decoded = verifyRefreshToken(token) as { id: string };
            } catch {
                throw new AppError(401, "Invalid or expired refresh token");
            }

            if (!decoded?.id) {
                throw new AppError(401, "Invalid refresh token payload");
            }

            const tokens = await this.authService.refreshAccessToken(decoded.id, token);

            // Set the new refresh token cookie
            res.cookie("refreshToken", tokens.refreshToken, {
                httpOnly: true,
                secure: config.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 1000 * 60 * 60 * 24 * 7,
            });

            response(res, 200, "Token refreshed", { accessToken: tokens.accessToken });
        } catch (error) {
            next(error);
        }
    }
}
