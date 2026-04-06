import mongoose, { Schema, type Document, type Types } from "mongoose";

export type UserRole = "admin" | "driver" | "student";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  assignedBus?: Types.ObjectId | null;
  /** Stop on the assigned bus's route where the student boards (optional). */
  boardingStop?: Types.ObjectId | null;
  pushSubscription?: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["admin", "driver", "student"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
    assignedBus: { type: Schema.Types.ObjectId, ref: "Bus", default: null },
    boardingStop: { type: Schema.Types.ObjectId, ref: "Stop", default: null },
    pushSubscription: {
      endpoint: String,
      keys: { p256dh: String, auth: String },
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ assignedBus: 1 });
userSchema.index({ boardingStop: 1 });

export const User = mongoose.model<IUser>("User", userSchema);
