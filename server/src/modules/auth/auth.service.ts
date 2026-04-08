import { generateTokens } from "../../shared/utils/jwt.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthRepository } from "./auth.repository.js";
import type { Profile } from "passport-google-oauth20";
import { createLogger } from "../../shared/utils/logger.js";
import type { ITenant } from "../tenant/tenant.entity.js";

const log = createLogger("AuthService");

/**
 * Service layer for authentication operations.
 * Handles Google OAuth login, token generation, refresh, and logout.
 */
export class AuthService {
    constructor(private readonly authRepo: AuthRepository) { }

    /**
     * Handles Google OAuth login - finds or creates a tenant.
     * @param {Profile} profile - Google OAuth profile
     * @returns {Promise<ITenant>} Existing or newly created tenant
     * @throws {AppError} 400 if email is not found in the profile
     */
    async handleGoogleLogin(profile: Profile): Promise<ITenant> {
        log.info(`Processing Google login for user: ${profile.id}`);
        let tenant = await this.authRepo.findByGoogleId(profile.id);

        if (!tenant) {
            const email = profile.emails?.[0]?.value;
            if (!email) {
                log.error("Email not found in Google profile", { googleId: profile.id });
                throw new AppError(400, "Email not found in Google profile");
            }

            log.info(`Creating new tenant for email: ${email}`);
            tenant = await this.authRepo.createTenant({
                google_id: profile.id,
                email: email,
                name: profile.displayName,
                avatar: profile.photos?.[0]?.value,
            });
        }

        return tenant;
    }

    /**
     * Finds or creates a Demo User for testing purposes.
     * @returns {Promise<{ refreshToken: string, accessToken: string }>} tokens
     */
    async handleDemoLogin(): Promise<{ refreshToken: string; accessToken: string; }> {
        const demoEmail = "demo@monito.api";
        log.info(`Processing Demo Login for: ${demoEmail}`);

        let tenant = await this.authRepo.findByEmail(demoEmail);

        if (!tenant) {
            log.info(`Creating NEW Demo Tenant account`);
            tenant = await this.authRepo.createTenant({
                email: demoEmail,
                name: "Demo Account",
                avatar: "https://ui-avatars.com/api/?name=Demo+User&background=0D9488&color=fff",
                is_admin: false,
            });
        }

        const { refreshToken, accessToken } = generateTokens({ id: tenant.id, email: tenant.email });

        await this.authRepo.updateRefreshToken(tenant.id, refreshToken);
        log.info(`Demo tokens generated for: ${tenant.email}`);

        return { refreshToken, accessToken };
    }

    /**
     * Deserializes a user from session by tenant ID.
     * @param {string} id - Tenant UUID
     * @returns {Promise<ITenant | null>} Tenant or null if not found
     */
    async deserializeUser(id: string): Promise<ITenant | null> {
        const user = await this.authRepo.findById(id);
        if (!user) {
            log.warn(`Deserialization failed: User ${id} not found`);
        }
        return user;
    }

    /**
     * Generates tokens after successful Google OAuth callback.
     * @param {string} userId - Tenant UUID
     * @returns {Promise<{ refreshToken: string, accessToken: string }>}
     * @throws {AppError} 404 if user not found
     */
    async googleCallback(userId: string): Promise<{ refreshToken: string; accessToken: string; }> {
        const tenant = await this.authRepo.findById(userId);
        if (!tenant) {
            log.error(`Callback failed: User ${userId} not found`);
            throw new AppError(404, "User not found");
        }

        const { refreshToken, accessToken } = generateTokens({ id: tenant.id, email: tenant.email });

        await this.authRepo.updateRefreshToken(tenant.id, refreshToken);
        log.info(`Tokens generated for user: ${tenant.email}`);
        return { refreshToken, accessToken };
    }

    /**
     * Logs out a user by clearing their stored refresh token.
     * @param {string} userId - Tenant UUID
     * @returns {Promise<void>}
     */
    async logout(userId: string): Promise<void> {
        log.info(`Logging out user: ${userId}`);
        await this.authRepo.updateRefreshToken(userId, null);
    }

    /**
     * Refreshes access token after validating the incoming refresh
     * token against the one stored in the DB.
     * @param {string} userId - Tenant UUID from the decoded JWT
     * @param {string} incomingToken - Raw refresh token from the cookie
     * @returns {{ refreshToken: string; accessToken: string }}
     */
    async refreshAccessToken(userId: string, incomingToken: string): Promise<{ refreshToken: string; accessToken: string; }> {
        const tenant = await this.authRepo.findById(userId);
        if (!tenant) {
            log.error(`Token refresh failed: User ${userId} not found`);
            throw new AppError(404, "User not found");
        }

        // Verify the incoming token matches what's stored (revocation check)
        if (!tenant.refresh_token || tenant.refresh_token !== incomingToken) {
            log.warn(`Refresh token mismatch for user ${userId} - possible revoked or rotated token`);
            throw new AppError(401, "Refresh token has been revoked");
        }

        const { refreshToken, accessToken } = generateTokens({ id: tenant.id, email: tenant.email });

        await this.authRepo.updateRefreshToken(tenant.id, refreshToken);
        log.info(`Tokens refreshed for user: ${tenant.email}`);
        return { refreshToken, accessToken };
    }

    /**
     * Returns the authenticated user's profile.
     * @param {string} userId - Tenant UUID
     * @returns {Promise<ITenant>} Tenant profile
     * @throws {AppError} 404 if user not found
     */
    async getMe(userId: string): Promise<ITenant> {
        const tenant = await this.authRepo.findById(userId);
        if (!tenant) {
            log.error(`GetMe failed: User ${userId} not found`);
            throw new AppError(404, "User not found");
        }

        // Strip sensitive fields before returning to client
        const { refresh_token, ...safeProfile } = tenant;
        return safeProfile;
    }
}
