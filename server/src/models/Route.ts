import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRoute extends Document {
  name: string;
  /** Ordered [lng, lat] pairs for path + ETA along polyline */
  polyline: [number, number][];
  avgSpeedKmh?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const routeSchema = new Schema<IRoute>(
  {
    name: { type: String, required: true, trim: true },
    polyline: {
      type: [[Number]],
      default: [],
      validate: {
        validator(v: number[][]) {
          return v.every((p) => p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number");
        },
        message: "polyline must be array of [lng, lat]",
      },
    },
    avgSpeedKmh: { type: Number, min: 1, max: 200 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

routeSchema.index({ name: 1 });

export const Route = mongoose.model<IRoute>("Route", routeSchema);
