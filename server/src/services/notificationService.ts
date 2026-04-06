import type { Types } from "mongoose";
import { Notification } from "../models/Notification.js";
import type { NotificationType } from "../models/Notification.js";
import { getIo } from "../sockets/index.js";

export async function createInAppNotification(
  userId: Types.ObjectId | string,
  title: string,
  body: string,
  type: NotificationType
): Promise<void> {
  const doc = await Notification.create({
    user: userId,
    title,
    body,
    type,
  });
  const id = String(doc._id);
  try {
    getIo().to(`user:${String(userId)}`).emit("notification:new", {
      id,
      title,
      body,
      type,
      createdAt: doc.createdAt.toISOString(),
    });
  } catch {
    // Socket may be unavailable in tests
  }
}
