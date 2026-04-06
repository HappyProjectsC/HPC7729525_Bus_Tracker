import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { User } from "../models/User.js";
import { Route } from "../models/Route.js";
import { Stop } from "../models/Stop.js";
import { Bus } from "../models/Bus.js";

config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI required");
  process.exit(1);
}
const mongoUri: string = uri;

async function seed(): Promise<void> {
  await mongoose.connect(mongoUri);
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@college.edu";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";
  let admin = await User.findOne({ email: email.toLowerCase() });
  if (!admin) {
    const passwordHash = await bcrypt.hash(password, 12);
    admin = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name: "Erode Campus Admin",
      role: "admin",
    });
    console.log("Created admin:", admin.email);
  } else {
    console.log("Admin exists:", admin.email);
  }

  // Erode, Tamil Nadu — campus shuttle around ~11.34°N, 77.72°E (GeoJSON [lng, lat])
  let route = await Route.findOne({ name: "Erode Campus Loop" });
  if (!route) {
    route = await Route.create({
      name: "Erode Campus Loop",
      polyline: [
        [77.7148, 11.3395],
        [77.7172, 11.341],
        [77.7192, 11.3422],
      ],
      avgSpeedKmh: 25,
      isActive: true,
    });
    await Stop.create([
      {
        route: route._id,
        name: "Main Gate",
        order: 0,
        location: { type: "Point", coordinates: [77.7148, 11.3395] },
      },
      {
        route: route._id,
        name: "Library / Academic Block",
        order: 1,
        location: { type: "Point", coordinates: [77.7172, 11.341] },
      },
      {
        route: route._id,
        name: "Hostel Block",
        order: 2,
        location: { type: "Point", coordinates: [77.7192, 11.3422] },
      },
    ]);
    console.log("Demo route created");
  }

  let bus = await Bus.findOne({ label: "Bus 1" });
  if (!bus) {
    bus = await Bus.create({
      label: "Bus 1",
      plate: "TN-38-AB-1234",
      status: "idle",
      route: route?._id,
    });
    console.log("Demo bus created");
  }

  await mongoose.disconnect();
  console.log("Seed done.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
