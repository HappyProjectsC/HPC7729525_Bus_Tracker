import type { Response } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import type { HydratedDocument } from "mongoose";
import { User, type IUser } from "../models/User.js";
import { Bus } from "../models/Bus.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import {
  paginationSchema,
  createUserSchema,
  assignStudentBusSchema,
  adminUpdateUserSchema,
} from "../validators/domain.js";

export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = paginationSchema.parse(req.query);
  const role = req.query.role as string | undefined;
  const filter: Record<string, unknown> = {};
  if (role && ["admin", "driver", "student", "parent"].includes(role)) {
    filter.role = role;
  }
  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    User.find(filter)
      .select("-passwordHash")
      .populate("assignedBus", "label plate")
      .populate("linkedStudent", "name email")
      .populate("linkedParent", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(q.limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: { items, total, page: q.page, limit: q.limit } });
});

export const createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = createUserSchema.parse(req.body);
  const { confirmPassword: _c, ...body } = parsed;
  const existing = await User.findOne({ email: body.email.toLowerCase() });
  if (existing) throw new AppError(409, "This email is already in use");
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

async function applyParentStudentLink(
  parent: HydratedDocument<IUser>,
  linkedStudentId: string | null
): Promise<void> {
  if (parent.role !== "parent") throw new AppError(400, "User is not a parent");

  const prevStudentId = parent.linkedStudent ? String(parent.linkedStudent) : null;

  if (linkedStudentId === null) {
    if (prevStudentId) {
      await User.findByIdAndUpdate(prevStudentId, { $set: { linkedParent: null } });
    }
    parent.linkedStudent = null;
    return;
  }

  const student = await User.findById(linkedStudentId);
  if (!student || student.role !== "student") throw new AppError(404, "Student not found");

  if (prevStudentId && prevStudentId !== String(student._id)) {
    await User.findByIdAndUpdate(prevStudentId, { $set: { linkedParent: null } });
  }

  const existingParentId = student.linkedParent ? String(student.linkedParent) : null;
  if (existingParentId && existingParentId !== String(parent._id)) {
    await User.findByIdAndUpdate(existingParentId, { $set: { linkedStudent: null } });
  }

  parent.linkedStudent = student._id;
  student.linkedParent = parent._id;
  await student.save();
}

export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = adminUpdateUserSchema.parse(req.body);
  const keys = Object.keys(parsed).filter((k) => parsed[k as keyof typeof parsed] !== undefined);
  if (keys.length === 0) throw new AppError(400, "No fields to update");

  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, "User not found");

  if (parsed.name !== undefined) user.name = parsed.name.trim();
  if (parsed.email !== undefined) {
    const email = parsed.email.toLowerCase().trim();
    const clash = await User.findOne({ email, _id: { $ne: user._id } });
    if (clash) throw new AppError(409, "This email is already in use");
    user.email = email;
  }
  if (parsed.password !== undefined) {
    user.passwordHash = await bcrypt.hash(parsed.password, 12);
  }
  if (parsed.isActive !== undefined) user.isActive = parsed.isActive;

  if (parsed.linkedStudentId !== undefined) {
    if (user.role !== "parent") throw new AppError(400, "linkedStudentId only applies to parent accounts");
    await applyParentStudentLink(user, parsed.linkedStudentId);
  }

  await user.save();

  const out = await User.findById(user._id)
    .select("-passwordHash")
    .populate("assignedBus", "label plate")
    .populate("linkedStudent", "name email")
    .populate("linkedParent", "name email")
    .lean();
  res.json({ success: true, data: out });
});

export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  if (String(req.user.sub) === req.params.id) {
    throw new AppError(400, "You cannot delete your own account");
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, "User not found");

  if (user.role === "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) throw new AppError(400, "Cannot delete the last admin");
  }

  if (user.role === "student" && user.linkedParent) {
    await User.findByIdAndUpdate(user.linkedParent, { $set: { linkedStudent: null } });
  }
  if (user.role === "parent" && user.linkedStudent) {
    await User.findByIdAndUpdate(user.linkedStudent, { $set: { linkedParent: null } });
  }

  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true, data: { deleted: true } });
});
