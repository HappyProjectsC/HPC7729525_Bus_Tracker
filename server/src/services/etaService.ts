import type { IStop } from "../models/Stop.js";
import { haversineMeters, progressAlongPolyline } from "../utils/geo.js";
import { env } from "../config/env.js";

export interface StopEta {
  stopId: string;
  name: string;
  order: number;
  distanceMeters: number;
  etaMinutes: number;
}

/**
 * ETA from bus position to each stop: straight-line cumulative from current to stops in order.
 * Uses haversine between bus and first stop, then between consecutive stops.
 */
export function computeEtasForStops(
  busLat: number,
  busLng: number,
  stops: Pick<IStop, "_id" | "name" | "order" | "location">[],
  avgSpeedKmh: number
): StopEta[] {
  const speed = avgSpeedKmh > 0 ? avgSpeedKmh : env.DEFAULT_AVG_SPEED_KMH;
  const mPerMin = (speed * 1000) / 60;
  const sorted = [...stops].sort((a, b) => a.order - b.order);
  const result: StopEta[] = [];
  let fromLat = busLat;
  let fromLng = busLng;
  for (const s of sorted) {
    const [slng, slat] = s.location.coordinates;
    const d = haversineMeters(fromLat, fromLng, slat, slng);
    result.push({
      stopId: String(s._id),
      name: s.name,
      order: s.order,
      distanceMeters: Math.round(d),
      etaMinutes: Math.round((d / mPerMin) * 10) / 10,
    });
    fromLat = slat;
    fromLng = slng;
  }
  return result;
}

/** ETA using route polyline: distance along polyline from projected bus position to each stop's nearest polyline point — simplified: use straight-line from bus to stop order with polyline length adjustment factor */
export function computeEtasWithPolyline(
  busLat: number,
  busLng: number,
  polyline: [number, number][],
  stops: Pick<IStop, "_id" | "name" | "order" | "location">[],
  avgSpeedKmh: number
): StopEta[] {
  const speed = avgSpeedKmh > 0 ? avgSpeedKmh : env.DEFAULT_AVG_SPEED_KMH;
  const mPerMin = (speed * 1000) / 60;
  if (!polyline.length) {
    return computeEtasForStops(busLat, busLng, stops, speed);
  }
  const { distanceFromStartM } = progressAlongPolyline(busLat, busLng, polyline);
  const sorted = [...stops].sort((a, b) => a.order - b.order);
  const out: StopEta[] = [];
  for (const s of sorted) {
    const [slng, slat] = s.location.coordinates;
    const prog = progressAlongPolyline(slat, slng, polyline);
    const alongStop = prog.distanceFromStartM;
    const dAlong = Math.max(0, alongStop - distanceFromStartM);
    const d = dAlong > 0 ? dAlong : haversineMeters(busLat, busLng, slat, slng);
    out.push({
      stopId: String(s._id),
      name: s.name,
      order: s.order,
      distanceMeters: Math.round(d),
      etaMinutes: Math.round((d / mPerMin) * 10) / 10,
    });
  }
  return out;
}
