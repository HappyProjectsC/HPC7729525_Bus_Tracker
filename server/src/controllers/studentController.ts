import type { Response } from "express";
import { Bus } from "../models/Bus.js";
import { Stop } from "../models/Stop.js";
import { User } from "../models/User.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { computeEtasWithPolyline } from "../services/etaService.js";
import { env } from "../config/env.js";
import { setBoardingStopSchema } from "../validators/domain.js";

export const myBus = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  const user = await User.findById(req.user.sub).lean();
  if (!user?.assignedBus) {
    res.json({ success: true, data: null });
    return;
  }
  const bus = await Bus.findById(user.assignedBus).populate("route").lean();
  if (!bus) {
    res.json({ success: true, data: null });
    return;
  }
  const route = bus.route && typeof bus.route === "object" && "_id" in bus.route ? bus.route : null;
  const routeId = route && "_id" in route ? route._id : null;
  const stops = routeId
    ? await Stop.find({ route: routeId }).sort({ order: 1 }).lean()
    : [];
  let boardingStop: { _id: string; name: string; order: number } | null = null;
  if (user.boardingStop && routeId) {
    const bs = await Stop.findOne({ _id: user.boardingStop, route: routeId }).lean();
    if (bs) {
      boardingStop = { _id: String(bs._id), name: bs.name, order: bs.order };
    } else {
      await User.updateOne({ _id: user._id }, { $unset: { boardingStop: 1 } });
    }
  }
  let etas: ReturnType<typeof computeEtasWithPolyline> = [];
  const lat = bus.lastLocation?.coordinates?.[1];
  const lng = bus.lastLocation?.coordinates?.[0];
  if (lat != null && lng != null && stops.length && route && typeof route === "object" && "polyline" in route) {
    const poly = (route as { polyline?: [number, number][] }).polyline ?? [];
    const avg =
      (route as { avgSpeedKmh?: number }).avgSpeedKmh ?? env.DEFAULT_AVG_SPEED_KMH;
    etas = computeEtasWithPolyline(lat, lng, poly, stops, avg);
  }
  res.json({
    success: true,
    data: {
      bus,
      route,
      stops,
      etas,
      boardingStop,
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
