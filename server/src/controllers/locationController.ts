import type { Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { locationBodySchema } from "../validators/domain.js";
import {
  assertDriverOwnsBus,
  validateLocationPlausibility,
  updateBusLocation,
} from "../services/locationService.js";
import { logger } from "../config/logger.js";
import { getIo } from "../sockets/index.js";

export const postLocation = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== "driver") throw new AppError(403, "Driver only");
  const body = locationBodySchema.parse(req.body);
  const bus = await assertDriverOwnsBus(req.user.sub, body.busId);
  if (!bus.isTracking) {
    throw new AppError(400, "Tracking not started");
  }
  const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();
  const bad = validateLocationPlausibility(body.busId, body.lat, body.lng, recordedAt);
  if (bad) {
    logger.warn(`Location rejected: ${bad}`, { busId: body.busId });
    throw new AppError(400, bad);
  }
  await updateBusLocation(
    body.busId,
    body.lat,
    body.lng,
    body.speedKmh,
    body.heading,
    true
  );
  const payload = {
    busId: body.busId,
    lat: body.lat,
    lng: body.lng,
    speedKmh: body.speedKmh,
    heading: body.heading,
    recordedAt: recordedAt.toISOString(),
  };
  try {
    const io = getIo();
    io.to(`bus:${body.busId}`).emit("bus:location", payload);
    io.to("admin").emit("bus:location", payload);
  } catch {
    // Socket.IO not initialized (e.g. some tests)
  }
  res.json({ success: true });
});
