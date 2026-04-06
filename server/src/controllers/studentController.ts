import type { Response } from "express";
import { Bus } from "../models/Bus.js";
import { Stop } from "../models/Stop.js";
import { User } from "../models/User.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { setBoardingStopSchema, addParentSchema, studentFeedbackSchema } from "../validators/domain.js";
import { buildMyBusPayloadForStudent } from "../services/myBusPayloadService.js";
import { BusFeedback } from "../models/BusFeedback.js";
import bcrypt from "bcryptjs";

export const myBus = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const data = await buildMyBusPayloadForStudent(req.user.sub);
  if (!data) {
    res.json({ success: true, data: null });
    return;
  }
  res.json({ success: true, data: data });
});

export const addParent = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const parsed = addParentSchema.parse(req.body);
  const { confirmPassword: _c, ...body } = parsed;
  const student = await User.findById(req.user.sub);
  if (!student || student.role !== "student") throw new AppError(403, "Forbidden");
  if (student.linkedParent) {
    throw new AppError(400, "A parent is already linked to your account");
  }
  const email = body.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError(409, "This email is already in use");
  }
  const passwordHash = await bcrypt.hash(body.password, 12);
  const parent = await User.create({
    email,
    passwordHash,
    name: body.name.trim(),
    role: "parent",
    linkedStudent: student._id,
  });
  student.linkedParent = parent._id;
  await student.save();
  res.status(201).json({
    success: true,
    data: {
      parent: { id: parent._id, email: parent.email, name: parent.name, role: parent.role },
    },
  });
});

export const setBoardingStop = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const { stopId } = setBoardingStopSchema.parse(req.body);
  const user = await User.findById(req.user.sub);
  if (!user || user.role !== "student") throw new AppError(403, "Forbidden");
  if (!user.assignedBus) throw new AppError(400, "No bus assigned");
  const bus = await Bus.findById(user.assignedBus).populate("route");
  if (!bus) throw new AppError(400, "Bus not found");
  const route = bus.route && typeof bus.route === "object" && "_id" in bus.route ? bus.route : null;
  const routeId = route && "_id" in route ? route._id : null;
  if (!routeId) throw new AppError(400, "Bus has no route");

  if (stopId === null) {
    user.boardingStop = null;
    await user.save();
    res.json({ success: true, data: { boardingStop: null } });
    return;
  }
  const stop = await Stop.findOne({ _id: stopId, route: routeId });
  if (!stop) throw new AppError(400, "Stop is not on your bus route");
  user.boardingStop = stop._id;
  await user.save();
  res.json({
    success: true,
    data: {
      boardingStop: { _id: String(stop._id), name: stop.name, order: stop.order },
    },
  });
});

export const submitFeedback = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const body = studentFeedbackSchema.parse(req.body);
  const user = await User.findById(req.user.sub);
  if (!user || user.role !== "student") throw new AppError(403, "Forbidden");
  if (!user.assignedBus) throw new AppError(400, "No bus assigned");
  const fb = await BusFeedback.create({
    bus: user.assignedBus,
    student: user._id,
    message: body.message.trim(),
    status: "open",
  });
  res.status(201).json({
    success: true,
    data: { id: String(fb._id) },
  });
});
