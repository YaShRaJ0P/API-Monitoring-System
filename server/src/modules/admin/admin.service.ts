import { AdminRepository } from "./admin.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { RabbitMQ } from "../../config/rabbitmq.js";
import { CircuitRegistry } from "../../config/circuit.js";
import { createLogger } from "../../shared/utils/logger.js";

const log = createLogger("AdminService");


export class AdminService {
    constructor(private readonly adminRepo: AdminRepository) { }

    /**
     * Get all Users
     * @returns {Promise<any[]>} Array of users with project counts
     */
    async getUsers(): Promise<any[]> {
        return this.adminRepo.getUsers();
    }

    /**
     * Delete User
     * @param {string} id - User ID
     * @param {string} callerId - Caller ID
     * @returns {Promise<boolean>} True if user was deleted
     */
    async deleteUser(id: string, callerId: string): Promise<boolean> {
        if (id === callerId) {
            throw new AppError(400, "You cannot delete your own account");
        }
        const rowCount = await this.adminRepo.deleteUser(id);
        if (rowCount === 0) {
            throw new AppError(404, "User not found");
        }
        return true;
    }

    /**
     * Toggle Admin
     * @param {string} id - User ID
     * @param {string} callerId - Caller ID
     * @returns {Promise<any>} Updated user
     */
    async toggleAdmin(id: string, callerId: string): Promise<any> {
        if (id === callerId) {
            throw new AppError(400, "You cannot change your own admin status");
        }
        const updated = await this.adminRepo.toggleAdmin(id);
        if (!updated) {
            throw new AppError(404, "User not found");
        }
        return updated;
    }

    /**
     * Get System Stats
     * @returns {Promise<any>} System stats
     */
    async getSystemStats(): Promise<any> {
        const stats = await this.adminRepo.getSystemStats();
        return {
            total_users: parseInt(stats.tenants.rows[0].total, 10),
            total_projects: parseInt(stats.projects.rows[0].total, 10),
            active_alert_rules: parseInt(stats.rules.rows[0].total, 10),
            outbox: {
                pending: parseInt(stats.outbox.rows[0].pending || "0", 10),
                processed: parseInt(stats.outbox.rows[0].processed || "0", 10),
                failed: parseInt(stats.outbox.rows[0].failed || "0", 10),
            },
            uptime_seconds: Math.floor(process.uptime()),
        };
    }

    /**
     * Disconnect RabbitMQ and enable simulation mode so auto-reconnect is suppressed.
     * This allows the circuit breaker to fully open and hold the disconnected state.
     */
    async rabbitMqDown() {
        RabbitMQ.setSimulationMode(true);
        await RabbitMQ.disconnect();
        return true;
    }

    /**
     * Clear simulation mode and reconnect RabbitMQ.
     * The circuit breaker will transition HALF-OPEN → CLOSED once the connection recovers.
     */
    async rabbitMqUp() {
        RabbitMQ.setSimulationMode(false);
        await RabbitMQ.getChannel();
        return true;
    }

    /**
     * Get RabbitMQ connection status string.
     */
    async rabbitMqStatus() {
        return RabbitMQ.getStatus();
    }

    /**
     * Returns a combined snapshot of the circuit breaker state, Redis buffer counts,
     * RabbitMQ connection status, and whether simulation mode is active.
     * Used by the admin circuit dashboard for real-time observability.
     * @returns {Promise<object>} Circuit breaker stats
     */
    async getCircuitBreakerStats(): Promise<object> {
        const rabbitmqStatus = RabbitMQ.getStatus();
        const simulationMode = RabbitMQ.getSimulationMode();
        const circuit = CircuitRegistry.get();

        if (!circuit) {
            return {
                rabbitmqStatus,
                simulationMode,
                circuitState: "unknown",
                bufferCount: 0,
                deadBufferCount: 0,
            };
        }

        const [bufferCount, deadBufferCount] = await Promise.all([
            circuit.getBufferCount(),
            circuit.getDeadBufferCount(),
        ]);

        return {
            rabbitmqStatus,
            simulationMode,
            circuitState: circuit.getState(),
            bufferCount,
            deadBufferCount,
        };
    }
}
