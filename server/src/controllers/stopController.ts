import type { Response } from "express";
import { Stop } from "../models/Stop.js";
import { Route } from "../models/Route.js";
import { User } from "../models/User.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { paginationSchema, createStopSchema } from "../validators/domain.js";

export const listStops = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = paginationSchema.parse(req.query);
  const routeId = req.query.route as string | undefined;
  const filter = routeId ? { route: routeId } : {};
  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    Stop.find(filter).sort({ route: 1, order: 1 }).skip(skip).limit(q.limit).lean(),
    Stop.countDocuments(filter),
  ]);
  res.json({ success: true, data: { items, total, page: q.page, limit: q.limit } });
});

export const createStop = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = createStopSchema.parse(req.body);
  const route = await Route.findById(body.route);
  if (!route) throw new AppError(404, "Route not found");
  const stop = await Stop.create({
    route: body.route,
    name: body.name,
    order: body.order,
    location: { type: "Point", coordinates: [body.lng, body.lat] },
  });
  res.status(201).json({ success: true, data: stop });
});

export const updateStop = asyncHandler(async (req: AuthRequest, res: Response) => {
  const partial = createStopSchema.partial().parse(req.body);
  const update: Record<string, unknown> = {};
  if (partial.name !== undefined) update.name = partial.name;
  if (partial.order !== undefined) update.order = partial.order;
  if (partial.route !== undefined) update.route = partial.route;
  if (partial.lat !== undefined && partial.lng !== undefined) {
    update.location = { type: "Point", coordinates: [partial.lng, partial.lat] };
  }
  const stop = await Stop.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!stop) throw new AppError(404, "Stop not found");
  res.json({ success: true, data: stop });
});

export const deleteStop = asyncHandler(async (req: AuthRequest, res: Response) => {
  const stop = await Stop.findByIdAndDelete(req.params.id);
  if (!stop) throw new AppError(404, "Stop not found");
  await User.updateMany({ boardingStop: stop._id }, { $unset: { boardingStop: 1 } });
  res.json({ success: true });
});
