import mongoose, { Schema } from "mongoose";

/**
 * Outbox Entry schema for eventual consistency between MongoDB and PostgreSQL.
 * The consumer writes raw events + outbox entries atomically to MongoDB.
 * The OutboxProcessor polls for pending entries and projects them to PostgreSQL.
 */

export type OutboxStatus = "pending" | "processed" | "failed";

export interface IOutboxEntry {
    event_id: string;
    payload: Record<string, unknown>;
    status: OutboxStatus;
    attempts: number;
    lastError?: string;
    createdAt: Date;
    processedAt?: Date;
}

const OutboxEntrySchema = new Schema<IOutboxEntry>(
    {
        event_id: { type: String, required: true, unique: true },
        payload: { type: Schema.Types.Mixed, required: true },
        status: {
            type: String,
            enum: ["pending", "processed", "failed"],
            default: "pending",
        },
        attempts: { type: Number, default: 0 },
        lastError: { type: String },
        createdAt: { type: Date, default: Date.now },
        processedAt: { type: Date },
    },
    { timestamps: false }
);

// Index for efficient polling: pending entries ordered by creation time
OutboxEntrySchema.index({ status: 1, createdAt: 1 });

export default mongoose.model<IOutboxEntry>("OutboxEntry", OutboxEntrySchema);
