import type { Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { pushSubscribeSchema } from "../validators/domain.js";
import { env } from "../config/env.js";

export const subscribe = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  if (!env.VAPID_PUBLIC_KEY) {
    throw new AppError(503, "Push notifications not configured on server");
  }
  const body = pushSubscribeSchema.parse(req.body);
  await User.findByIdAndUpdate(req.user.sub, {
    pushSubscription: {
      endpoint: body.endpoint,
      keys: body.keys,
    },
  });
  res.json({ success: true });
});

export const unsubscribe = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  await User.findByIdAndUpdate(req.user.sub, { $unset: { pushSubscription: 1 } });
  res.json({ success: true });
});

export const vapidPublicKey = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: { publicKey: env.VAPID_PUBLIC_KEY ?? null } });
});

export const listNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const items = await Notification.find({ user: req.user.sub })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const unread = await Notification.countDocuments({ user: req.user.sub, readAt: null });
  res.json({ success: true, data: { items, unread } });
});

export const markRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.sub },
    { readAt: new Date() },
    { new: true }
  );
  if (!n) throw new AppError(404, "Not found");
  res.json({ success: true });
});

export const markAllRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  await Notification.updateMany({ user: req.user.sub, readAt: null }, { readAt: new Date() });
  res.json({ success: true });
});
