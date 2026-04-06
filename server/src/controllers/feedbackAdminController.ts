import type { Response } from "express";
import mongoose from "mongoose";
import { BusFeedback } from "../models/BusFeedback.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { adminFeedbackPatchSchema } from "../validators/domain.js";
import { createInAppNotification } from "../services/notificationService.js";
import { sendPushToUser } from "../services/pushService.js";

export const listFeedbackForBus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const busId = req.params.id;
  const items = await BusFeedback.find({ bus: busId })
    .sort({ createdAt: -1 })
    .populate("student", "name email")
    .lean();
  res.json({ success: true, data: { items } });
});

export const patchFeedback = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const body = adminFeedbackPatchSchema.parse(req.body);
  const fb = await BusFeedback.findById(req.params.id);
  if (!fb) throw new AppError(404, "Feedback not found");
  fb.adminResponse = body.adminResponse;
  fb.status = body.status ?? "resolved";
  fb.respondedAt = new Date();
  fb.respondedBy = new mongoose.Types.ObjectId(req.user.sub);
  await fb.save();

  const title = "Response to your bus feedback";
  const preview =
    body.adminResponse.length > 200 ? `${body.adminResponse.slice(0, 199)}…` : body.adminResponse;
  await createInAppNotification(fb.student, title, preview, "feedback_reply");
  await sendPushToUser(String(fb.student), title, preview, `feedback-${fb._id}`);

  res.json({ success: true, data: fb });
});
