import type { Types } from "mongoose";
import { Bus } from "../models/Bus.js";
import { Stop } from "../models/Stop.js";
import { User } from "../models/User.js";
import { computeEtasWithPolyline } from "./etaService.js";
import { env } from "../config/env.js";

/** Shared payload for student and parent (parent uses linked student's bus). */
export async function buildMyBusPayloadForBusId(assignedBusId: Types.ObjectId | string): Promise<{
  bus: unknown;
  route: unknown;
  stops: unknown[];
  etas: ReturnType<typeof computeEtasWithPolyline>;
  boardingStop: { _id: string; name: string; order: number } | null;
} | null> {
  const bus = await Bus.findById(assignedBusId).populate("route").lean();
  if (!bus) return null;
  const route = bus.route && typeof bus.route === "object" && "_id" in bus.route ? bus.route : null;
  const routeId = route && "_id" in route ? route._id : null;
  const stops = routeId ? await Stop.find({ route: routeId }).sort({ order: 1 }).lean() : [];
  let boardingStop: { _id: string; name: string; order: number } | null = null;
  let etas: ReturnType<typeof computeEtasWithPolyline> = [];
  const lat = bus.lastLocation?.coordinates?.[1];
  const lng = bus.lastLocation?.coordinates?.[0];
  if (lat != null && lng != null && stops.length && route && typeof route === "object" && "polyline" in route) {
    const poly = (route as { polyline?: [number, number][] }).polyline ?? [];
    const avg = (route as { avgSpeedKmh?: number }).avgSpeedKmh ?? env.DEFAULT_AVG_SPEED_KMH;
    etas = computeEtasWithPolyline(lat, lng, poly, stops, avg);
  }
  return { bus, route, stops, etas, boardingStop };
}

/** Student: includes boarding stop resolution from their user doc. */
export async function buildMyBusPayloadForStudent(userId: Types.ObjectId | string): Promise<{
  bus: unknown;
  route: unknown;
  stops: unknown[];
  etas: ReturnType<typeof computeEtasWithPolyline>;
  boardingStop: { _id: string; name: string; order: number } | null;
} | null> {
  const user = await User.findById(userId).lean();
  if (!user?.assignedBus) return null;
  const base = await buildMyBusPayloadForBusId(user.assignedBus);
  if (!base) return null;
  const routeId =
    base.route && typeof base.route === "object" && "_id" in base.route
      ? (base.route as { _id: Types.ObjectId })._id
      : null;
  let boardingStop = base.boardingStop;
  if (user.boardingStop && routeId) {
    const bs = await Stop.findOne({ _id: user.boardingStop, route: routeId }).lean();
    if (bs) {
      boardingStop = { _id: String(bs._id), name: bs.name, order: bs.order };
    } else {
      await User.updateOne({ _id: user._id }, { $unset: { boardingStop: 1 } });
      boardingStop = null;
    }
  }
  return { ...base, boardingStop };
}

/** Parent: boarding stop comes from linked student's settings. */
export async function buildMyBusPayloadForParent(parentId: Types.ObjectId | string): Promise<{
  bus: unknown;
  route: unknown;
  stops: unknown[];
  etas: ReturnType<typeof computeEtasWithPolyline>;
  boardingStop: { _id: string; name: string; order: number } | null;
} | null> {
  const parent = await User.findById(parentId).lean();
  if (!parent || parent.role !== "parent" || !parent.linkedStudent) return null;
  const student = await User.findById(parent.linkedStudent).lean();
  if (!student?.assignedBus) return null;
  const base = await buildMyBusPayloadForBusId(student.assignedBus);
  if (!base) return null;
  const routeId =
    base.route && typeof base.route === "object" && "_id" in base.route
      ? (base.route as { _id: Types.ObjectId })._id
      : null;
  let boardingStop: { _id: string; name: string; order: number } | null = null;
  if (student.boardingStop && routeId) {
    const bs = await Stop.findOne({ _id: student.boardingStop, route: routeId }).lean();
    if (bs) {
      boardingStop = { _id: String(bs._id), name: bs.name, order: bs.order };
    }
  }
  return { ...base, boardingStop };
}
