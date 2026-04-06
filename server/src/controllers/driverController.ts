import type { Response } from "express";
import { Bus } from "../models/Bus.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";

export const myBus = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== "driver") throw new AppError(403, "Driver only");
  const bus = await Bus.findOne({ assignedDriver: req.user.sub })
    .populate("route")
    .lean();
  if (!bus) {
    res.json({ success: true, data: null });
    return;
  }
  res.json({ success: true, data: bus });
});

export const startTracking = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const bus = await Bus.findOne({ assignedDriver: req.user.sub });
  if (!bus) throw new AppError(400, "No bus assigned");
  bus.isTracking = true;
  bus.status = "active";
  await bus.save();
  res.json({ success: true, data: { busId: bus._id, isTracking: bus.isTracking } });
});

export const stopTracking = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const bus = await Bus.findOne({ assignedDriver: req.user.sub });
  if (!bus) throw new AppError(400, "No bus assigned");
  bus.isTracking = false;
  await bus.save();
  const { clearBusLast } = await import("../services/locationService.js");
  clearBusLast(String(bus._id));
  res.json({ success: true, data: { busId: bus._id, isTracking: bus.isTracking } });
});
