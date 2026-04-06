import type { Response } from "express";
import { Route } from "../models/Route.js";
import { Stop } from "../models/Stop.js";
import { Bus } from "../models/Bus.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { AuthRequest } from "../middleware/auth.js";
import { paginationSchema, createRouteSchema } from "../validators/domain.js";

export const listRoutes = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = paginationSchema.parse(req.query);
  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    Route.find().sort({ name: 1 }).skip(skip).limit(q.limit).lean(),
    Route.countDocuments(),
  ]);
  res.json({ success: true, data: { items, total, page: q.page, limit: q.limit } });
});

export const getRoute = asyncHandler(async (req: AuthRequest, res: Response) => {
  const route = await Route.findById(req.params.id).lean();
  if (!route) throw new AppError(404, "Route not found");
  const stops = await Stop.find({ route: route._id }).sort({ order: 1 }).lean();
  res.json({ success: true, data: { ...route, stops } });
});

export const createRoute = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = createRouteSchema.parse(req.body);
  const route = await Route.create(body);
  res.status(201).json({ success: true, data: route });
});

export const updateRoute = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = createRouteSchema.partial().parse(req.body);
  const route = await Route.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!route) throw new AppError(404, "Route not found");
  res.json({ success: true, data: route });
});

export const deleteRoute = asyncHandler(async (req: AuthRequest, res: Response) => {
  const route = await Route.findByIdAndDelete(req.params.id);
  if (!route) throw new AppError(404, "Route not found");
  await Stop.deleteMany({ route: route._id });
  await Bus.updateMany({ route: route._id }, { $unset: { route: 1 } });
  res.json({ success: true });
});
