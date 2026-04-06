import type { Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
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
