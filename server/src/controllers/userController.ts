import type { Response } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Bus } from "../models/Bus.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { paginationSchema, createUserSchema, assignStudentBusSchema } from "../validators/domain.js";

export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = paginationSchema.parse(req.query);
  const role = req.query.role as string | undefined;
  const filter: Record<string, unknown> = {};
  if (role && ["admin", "driver", "student"].includes(role)) {
    filter.role = role;
  }
  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    User.find(filter)
      .select("-passwordHash")
      .populate("assignedBus", "label plate")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(q.limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: { items, total, page: q.page, limit: q.limit } });
});

export const createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = createUserSchema.parse(req.body);
  const existing = await User.findOne({ email: body.email.toLowerCase() });
  if (existing) throw new AppError(409, "Email already exists");
  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await User.create({
    email: body.email.toLowerCase(),
    passwordHash,
    name: body.name,
    role: body.role,
  });
  const out = user.toObject();
  delete (out as { passwordHash?: string }).passwordHash;
  res.status(201).json({ success: true, data: out });
});

export const assignStudentBus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { busId } = assignStudentBusSchema.parse(req.body);
  const student = await User.findOne({ _id: req.params.id, role: "student" });
  if (!student) throw new AppError(404, "Student not found");
  const prevBus = student.assignedBus ? String(student.assignedBus) : null;
  if (busId) {
    const b = await Bus.findById(busId);
    if (!b) throw new AppError(404, "Bus not found");
    student.assignedBus = new mongoose.Types.ObjectId(busId);
  } else {
    student.assignedBus = null;
  }
  const nextBus = busId ? String(busId) : null;
  if (prevBus !== nextBus) {
    student.boardingStop = null;
  }
  await student.save();
  const out = await User.findById(student._id)
    .select("-passwordHash")
    .populate("assignedBus", "label plate")
    .lean();
  res.json({ success: true, data: out });
});

export const updateUserActive = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { isActive } = req.body as { isActive?: boolean };
  if (typeof isActive !== "boolean") throw new AppError(400, "isActive required");
  const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select(
    "-passwordHash"
  );
  if (!user) throw new AppError(404, "User not found");
  res.json({ success: true, data: user });
});
