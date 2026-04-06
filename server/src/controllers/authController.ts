import type { Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { hashToken } from "../utils/crypto.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { registerSchema, loginSchema, changePasswordSchema } from "../validators/auth.js";
import { parseDurationToMs } from "../utils/duration.js";

function refreshExpiryMs(): number {
  return parseDurationToMs(env.JWT_REFRESH_EXPIRES);
}

function setRefreshCookie(res: Response, token: string): void {
  const maxAge = refreshExpiryMs();
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    maxAge,
    path: "/api/auth",
  });
}

export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = registerSchema.parse(req.body);
  const { confirmPassword: _c, ...body } = parsed;
  const existing = await User.findOne({ email: body.email.toLowerCase() });
  if (existing) {
    throw new AppError(409, "This email is already in use");
  }
  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await User.create({
    email: body.email.toLowerCase(),
    passwordHash,
    name: body.name,
    role: "student",
  });
  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role,
    email: user.email,
  });
  const refreshToken = signRefreshToken(String(user._id));
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshExpiryMs()),
    userAgent: req.headers["user-agent"],
  });
  setRefreshCookie(res, refreshToken);
  res.status(201).json({
    success: true,
    data: {
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      accessToken,
    },
  });
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = loginSchema.parse(req.body);
  const user = await User.findOne({ email: body.email.toLowerCase() }).select("+passwordHash");
  if (!user || !user.isActive) {
    throw new AppError(401, "Invalid credentials");
  }
  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) {
    throw new AppError(401, "Invalid credentials");
  }
  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role,
    email: user.email,
  });
  const refreshToken = signRefreshToken(String(user._id));
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshExpiryMs()),
    userAgent: req.headers["user-agent"],
  });
  setRefreshCookie(res, refreshToken);
  res.json({
    success: true,
    data: {
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      accessToken,
    },
  });
});

export const refresh = asyncHandler(async (req: AuthRequest, res: Response) => {
  const token =
    req.cookies?.refreshToken ||
    (typeof req.body?.refreshToken === "string" ? req.body.refreshToken : null);
  if (!token) {
    throw new AppError(401, "Refresh token required");
  }
  let sub: string;
  try {
    sub = verifyRefreshToken(token).sub;
  } catch {
    throw new AppError(401, "Invalid refresh token");
  }
  const stored = await RefreshToken.findOne({ tokenHash: hashToken(token), user: sub });
  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError(401, "Invalid refresh token");
  }
  await RefreshToken.deleteOne({ _id: stored._id });
  const user = await User.findById(sub);
  if (!user || !user.isActive) {
    throw new AppError(401, "User not found");
  }
  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role,
    email: user.email,
  });
  const newRefresh = signRefreshToken(String(user._id));
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(newRefresh),
    expiresAt: new Date(Date.now() + refreshExpiryMs()),
    userAgent: req.headers["user-agent"],
  });
  setRefreshCookie(res, newRefresh);
  res.json({
    success: true,
    data: { accessToken },
  });
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await RefreshToken.deleteMany({ tokenHash: hashToken(token) });
  }
  res.clearCookie("refreshToken", { path: "/api/auth" });
  res.json({ success: true });
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const body = changePasswordSchema.parse(req.body);
  const user = await User.findById(req.user.sub).select("+passwordHash");
  if (!user) throw new AppError(404, "User not found");
  const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
  if (!ok) throw new AppError(401, "Current password is incorrect");
  user.passwordHash = await bcrypt.hash(body.newPassword, 12);
  await user.save();
  res.json({ success: true });
});

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError(401, "Unauthorized");
  }
  const user = await User.findById(req.user.sub).select("-passwordHash");
  if (!user) {
    throw new AppError(404, "User not found");
  }
  const base: Record<string, unknown> = {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    assignedBus: user.assignedBus,
  };
  if (user.role === "student" && user.linkedParent) {
    base.linkedParent = user.linkedParent;
  }
  res.json({
    success: true,
    data: base,
  });
});
