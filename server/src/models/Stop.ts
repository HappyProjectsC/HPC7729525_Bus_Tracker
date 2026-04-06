import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IStop extends Document {
  route: Types.ObjectId;
  name: string;
  order: number;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  createdAt: Date;
  updatedAt: Date;
}

const stopSchema = new Schema<IStop>(
  {
    route: { type: Schema.Types.ObjectId, ref: "Route", required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true, min: 0 },
    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true },
    },
  },
  { timestamps: true }
);

stopSchema.index({ route: 1, order: 1 }, { unique: true });
stopSchema.index({ location: "2dsphere" });

export const Stop = mongoose.model<IStop>("Stop", stopSchema);
