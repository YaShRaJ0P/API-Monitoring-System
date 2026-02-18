import mongoose, { Schema, Document } from "mongoose";

export interface IFailedJob extends Document {
    payload: any;
    errorMessage: string;
    retries: number;
    queue: string;
    createdAt: Date;
}

const FailedJobSchema: Schema = new Schema({
    payload: { type: Schema.Types.Mixed, required: true },
    errorMessage: { type: String, required: true },
    retries: { type: Number, required: true },
    queue: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IFailedJob>("FailedJob", FailedJobSchema);
