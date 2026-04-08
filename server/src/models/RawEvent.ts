import mongoose, { Schema, Document } from "mongoose";

export interface IRawEvent extends Document {
    event_id: string;
    tenant_id: string;
    project_id: string;
    endpoint: string;
    method: string;
    status: number;
    latency: number;
    timestamp: Date;
    environment: string;
    service: string;
    error?: string;
    createdAt: Date;
}

const RawEventSchema: Schema = new Schema({
    event_id: { type: String, required: true, unique: true },
    tenant_id: { type: String, required: true, index: true },
    project_id: { type: String, required: true, index: true },
    endpoint: { type: String, required: true },
    method: { type: String, required: true },
    status: { type: Number, required: true },
    latency: { type: Number, required: true },
    timestamp: { type: Date, required: true },
    environment: { type: String, required: true },
    service: { type: String, required: true },
    error: { type: String },
    createdAt: { type: Date, default: Date.now },
});

// Indexes for common queries
RawEventSchema.index({ project_id: 1, timestamp: -1 });
RawEventSchema.index({ tenant_id: 1, timestamp: -1 });
RawEventSchema.index({ service: 1, environment: 1 });

export default mongoose.model<IRawEvent>("RawEvent", RawEventSchema);
