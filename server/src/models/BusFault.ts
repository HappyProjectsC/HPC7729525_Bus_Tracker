import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IBusFault extends Document {
  bus: Types.ObjectId;
  driver: Types.ObjectId;
  message: string;
  createdAt: Date;
}

const busFaultSchema = new Schema<IBusFault>(
  {
    bus: { type: Schema.Types.ObjectId, ref: "Bus", required: true, index: true },
    driver: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
);

export const BusFault = mongoose.model<IBusFault>("BusFault", busFaultSchema);
