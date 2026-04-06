import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ILocationLog extends Document {
  bus: Types.ObjectId;
  coordinates: [number, number];
  recordedAt: Date;
  speedKmh?: number;
}

const locationLogSchema = new Schema<ILocationLog>(
  {
    bus: { type: Schema.Types.ObjectId, ref: "Bus", required: true, index: true },
    coordinates: { type: [Number], required: true },
    recordedAt: { type: Date, default: Date.now, index: true },
    speedKmh: { type: Number },
  },
  { timestamps: false }
);

locationLogSchema.index({ bus: 1, recordedAt: -1 });

export const LocationLog = mongoose.model<ILocationLog>("LocationLog", locationLogSchema);
