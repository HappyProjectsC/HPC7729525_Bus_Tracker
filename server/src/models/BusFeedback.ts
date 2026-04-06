import mongoose, { Schema, type Document, type Types } from "mongoose";

export type FeedbackStatus = "open" | "resolved";

export interface IBusFeedback extends Document {
  bus: Types.ObjectId;
  student: Types.ObjectId;
  message: string;
  status: FeedbackStatus;
  adminResponse?: string | null;
  respondedAt?: Date | null;
  respondedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const busFeedbackSchema = new Schema<IBusFeedback>(
  {
    bus: { type: Schema.Types.ObjectId, ref: "Bus", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    adminResponse: { type: String, maxlength: 4000, default: null },
    respondedAt: { type: Date, default: null },
    respondedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

busFeedbackSchema.index({ bus: 1, createdAt: -1 });

export const BusFeedback = mongoose.model<IBusFeedback>("BusFeedback", busFeedbackSchema);
