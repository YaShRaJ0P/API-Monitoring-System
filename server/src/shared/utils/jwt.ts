import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { config } from "../../config/config.js";
import type { StringValue } from "ms";

/**
 * Generates a pair of JWT tokens (access + refresh) for the given user.
 * @param {Object} user - User identity payload
 * @param {string} user.id - Tenant UUID
 * @param {string} user.email - Tenant email address
 * @returns {{ accessToken: string, refreshToken: string }} Token pair
 */
export const generateTokens = (user: { id: string; email: string }) => {
    const accessOptions: SignOptions = {
        expiresIn: config.jwt.access_token_expiry as StringValue | number,
    };

    const refreshOptions: SignOptions = {
        expiresIn: config.jwt.refresh_token_expiry as StringValue | number,
    };

    const accessToken = jwt.sign(
        { id: user.id, email: user.email },
        config.jwt.access_token_secret!,
        accessOptions
    );

    const refreshToken = jwt.sign(
        { id: user.id },
        config.jwt.refresh_token_secret!,
        refreshOptions
    );

    return { accessToken, refreshToken };
};

/**
 * Verifies and decodes an access token.
 * @param {string} token - JWT access token
 * @returns {jwt.JwtPayload | string} Decoded token payload
 * @throws {JsonWebTokenError} If the token is invalid or expired
 */
export const verifyAccessToken = (token: string) => {
    return jwt.verify(token, config.jwt.access_token_secret!);
};

/**
 * Verifies and decodes a refresh token.
 * @param {string} token - JWT refresh token
 * @returns {jwt.JwtPayload | string} Decoded token payload
 * @throws {JsonWebTokenError} If the token is invalid or expired
 */
export const verifyRefreshToken = (token: string) => {
    return jwt.verify(token, config.jwt.refresh_token_secret!);
};
