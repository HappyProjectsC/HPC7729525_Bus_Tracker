import mongoose, { Schema, type Document, type Types } from "mongoose";

export type BusStatus = "idle" | "active" | "maintenance";

export interface IBus extends Document {
  label: string;
  plate?: string;
  status: BusStatus;
  assignedDriver?: Types.ObjectId | null;
  route?: Types.ObjectId | null;
  lastLocation?: {
    type: "Point";
    coordinates: [number, number];
  };
  lastLocationAt?: Date;
  heading?: number;
  speedKmh?: number;
  isTracking: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const busSchema = new Schema<IBus>(
  {
    label: { type: String, required: true, trim: true },
    plate: { type: String, trim: true },
    status: {
      type: String,
      enum: ["idle", "active", "maintenance"],
      default: "idle",
    },
    assignedDriver: { type: Schema.Types.ObjectId, ref: "User", default: null },
    route: { type: Schema.Types.ObjectId, ref: "Route", default: null },
    lastLocation: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
    lastLocationAt: { type: Date },
    heading: { type: Number },
    speedKmh: { type: Number },
    isTracking: { type: Boolean, default: false },
  },
  { timestamps: true }
);

busSchema.index({ assignedDriver: 1 });
busSchema.index({ route: 1 });
busSchema.index({ lastLocation: "2dsphere" });

export const Bus = mongoose.model<IBus>("Bus", busSchema);
