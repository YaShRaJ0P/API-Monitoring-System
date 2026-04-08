import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../../shared/types/auth.types.js";
import { AdminService } from "./admin.service.js";
import { createLogger } from "../../shared/utils/logger.js";
import response from "../../shared/utils/response.js";
import { AppError } from "../../shared/errors/AppError.js";

const log = createLogger("AdminController");

export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    /**
     * Get all Users
     * @param {AuthRequest} req - Request object
     * @param {Response} res - Response object
     * @param {NextFunction} next - Next function
     */
    getUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const users = await this.adminService.getUsers();
            response(res, 200, "Users fetched successfully", users);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Delete User
     * @param {AuthRequest} req - Request object
     * @param {Response} res - Response object
     * @param {NextFunction} next - Next function
     */
    deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const callerId = req.id;
            if (!callerId) throw new AppError(401, "Unauthorized");

            await this.adminService.deleteUser(id as string, callerId);

            log.info(`Admin ${callerId} deleted user ${id}`);
            response(res, 200, "User deleted successfully", null);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Toggle Admin
     * @param {AuthRequest} req - Request object
     * @param {Response} res - Response object
     * @param {NextFunction} next - Next function
     */
    toggleAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const userId = req.id;
            if (!userId) throw new AppError(401, "Unauthorized");

            const updated = await this.adminService.toggleAdmin(id as string, userId);

            log.info(`Admin ${userId} toggled admin for user ${id} → ${updated.is_admin}`);
            response(res, 200, `User is now ${updated.is_admin ? "an admin" : "a regular user"}`, updated);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Get System Stats
     * @param {AuthRequest} req - Request object
     * @param {Response} res - Response object
     * @param {NextFunction} next - Next function
     */
    getSystemStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const stats = await this.adminService.getSystemStats();
            response(res, 200, "System stats fetched", stats);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Disconnect RabbitMQ
     */
    rabbitMqDown = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.adminService.rabbitMqDown();
            response(res, 200, "RabbitMQ disconnected successfully");
        } catch (error) {
            next(error);
        }
    };

    /**
     * Connect RabbitMQ
     */
    rabbitMqUp = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.adminService.rabbitMqUp();
            response(res, 200, "RabbitMQ connected successfully");
        } catch (error) {
            next(error);
        }
    };

    /**
     * Get RabbitMQ Status
     */
    rabbitMqStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const status = await this.adminService.rabbitMqStatus();
            response(res, 200, "RabbitMQ status fetched", { status });
        } catch (error) {
            next(error);
        }
    };

    /**
     * Returns a full circuit breaker snapshot: RabbitMQ status, circuit state,
     * Redis buffer counts, and simulation mode flag.
     * Used by the admin dashboard for real-time circuit observability.
     * @param {AuthRequest} req
     * @param {Response} res
     * @param {NextFunction} next
     */
    getCircuitStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const stats = await this.adminService.getCircuitBreakerStats();
            response(res, 200, "Circuit breaker stats fetched", stats);
        } catch (error) {
            next(error);
        }
    };
}
