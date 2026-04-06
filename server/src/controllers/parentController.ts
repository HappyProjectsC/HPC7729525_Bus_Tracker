import type { Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { buildMyBusPayloadForParent } from "../services/myBusPayloadService.js";

export const myBus = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const data = await buildMyBusPayloadForParent(req.user.sub);
  if (!data) {
    res.json({ success: true, data: null });
    return;
  }
  res.json({ success: true, data: data });
});
