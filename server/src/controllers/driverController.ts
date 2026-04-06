import type { Response } from "express";
import { Bus } from "../models/Bus.js";
import { User } from "../models/User.js";
import { BusFault } from "../models/BusFault.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { driverFaultSchema } from "../validators/domain.js";
import { getIo } from "../sockets/index.js";
import { createInAppNotification } from "../services/notificationService.js";
import { notifyBusAudiencePush } from "../services/pushService.js";

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

export const submitFault = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const body = driverFaultSchema.parse(req.body);
  const bus = await Bus.findOne({ assignedDriver: req.user.sub });
  if (!bus) throw new AppError(400, "No bus assigned");
  await BusFault.create({
    bus: bus._id,
    driver: req.user.sub,
    message: body.message,
  });
  const busId = String(bus._id);
  const title = "Bus issue reported";
  const shortBody = body.message.length > 160 ? `${body.message.slice(0, 159)}…` : body.message;
  const driverDoc = await User.findById(req.user.sub).select("name").lean();
  const payload = {
    busId,
    busLabel: bus.label,
    driverName: driverDoc?.name ?? "Driver",
    message: body.message,
    createdAt: new Date().toISOString(),
  };
  const io = getIo();
  io.to(`bus:${busId}`).emit("bus:fault", payload);
  io.to("admin").emit("bus:fault", payload);

  const students = await User.find({ role: "student", assignedBus: bus._id }).select("_id").lean();
  const studentIds = students.map((s) => s._id);
  const parents = studentIds.length
    ? await User.find({ role: "parent", linkedStudent: { $in: studentIds } }).select("_id").lean()
    : [];
  const ids = [...students.map((s) => String(s._id)), ...parents.map((p) => String(p._id))];
  for (const uid of ids) {
    await createInAppNotification(uid, title, shortBody, "fault");
  }
  await notifyBusAudiencePush(busId, title, body.message, "fault");

  res.status(201).json({ success: true, data: payload });
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
