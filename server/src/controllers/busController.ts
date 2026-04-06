import type { Response } from "express";
import { Bus } from "../models/Bus.js";
import { User } from "../models/User.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import {
  paginationSchema,
  createBusSchema,
  assignDriverSchema,
  assignRouteSchema,
} from "../validators/domain.js";

export const listBuses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = paginationSchema.parse(req.query);
  const filter: Record<string, unknown> = {};
  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    Bus.find(filter)
      .populate("assignedDriver", "name email")
      .populate("route", "name avgSpeedKmh")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(q.limit)
      .lean(),
    Bus.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: { items, total, page: q.page, limit: q.limit },
  });
});

export const getBus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bus = await Bus.findById(req.params.id)
    .populate("assignedDriver", "name email")
    .populate("route")
    .lean();
  if (!bus) throw new AppError(404, "Bus not found");
  res.json({ success: true, data: bus });
});

export const createBus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = createBusSchema.parse(req.body);
  const bus = await Bus.create(body);
  res.status(201).json({ success: true, data: bus });
});

export const updateBus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = createBusSchema.partial().parse(req.body);
  const bus = await Bus.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!bus) throw new AppError(404, "Bus not found");
  res.json({ success: true, data: bus });
});

export const deleteBus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bus = await Bus.findByIdAndDelete(req.params.id);
  if (!bus) throw new AppError(404, "Bus not found");
  await User.updateMany(
    { assignedBus: bus._id },
    { $unset: { assignedBus: 1, boardingStop: 1 } }
  );
  res.json({ success: true });
});

export const assignDriver = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { driverId } = assignDriverSchema.parse(req.body);
  if (driverId) {
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "driver") throw new AppError(400, "Invalid driver");
  }
  const bus = await Bus.findByIdAndUpdate(
    req.params.id,
    { assignedDriver: driverId || null },
    { new: true }
  ).populate("assignedDriver", "name email");
  if (!bus) throw new AppError(404, "Bus not found");
  res.json({ success: true, data: bus });
});

export const assignRouteToBus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { routeId } = assignRouteSchema.parse(req.body);
  const bus = await Bus.findByIdAndUpdate(
    req.params.id,
    { route: routeId || null },
    { new: true }
  ).populate("route");
  if (!bus) throw new AppError(404, "Bus not found");
  await User.updateMany({ assignedBus: bus._id }, { $unset: { boardingStop: 1 } });
  res.json({ success: true, data: bus });
});

export const snapshot = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bus = await Bus.findById(req.params.id).populate("route").lean();
  if (!bus) throw new AppError(404, "Bus not found");
  res.json({ success: true, data: bus });
});
