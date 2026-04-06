import type { IStop } from "../models/Stop.js";
import { haversineMeters, progressAlongPolyline } from "../utils/geo.js";
import { env } from "../config/env.js";

/** Polyline-based only; `unknown` when no polyline or polyline too short. */
export type StopRelativeToBus = "approaching" | "passed" | "unknown";

export interface StopEta {
  stopId: string;
  name: string;
  order: number;
  distanceMeters: number;
  etaMinutes: number;
  relativeToBus: StopRelativeToBus;
}

/** Meters: bus must be this far past the stop along the route to count as "passed" (reduces GPS jitter). */
const PASSED_STOP_BUFFER_M = 45;

/**
 * Fallback when no path with ≥2 vertices exists: straight-line hops from bus to each stop in order
 * (not road-following; prefer route polyline or stop-sequence path from {@link computeEtasWithPolyline}).
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
      relativeToBus: "unknown",
    });
    fromLat = slat;
    fromLng = slng;
  }
  return result;
}

/**
 * ETAs using distance **along** a path (polyline): either the route’s drawn path or, if missing,
 * consecutive stop coordinates in order (piecewise straight segments along the official stop sequence).
 */
export function computeEtasWithPolyline(
  busLat: number,
  busLng: number,
  polyline: [number, number][],
  stops: Pick<IStop, "_id" | "name" | "order" | "location">[],
  avgSpeedKmh: number
): StopEta[] {
  const speed = avgSpeedKmh > 0 ? avgSpeedKmh : env.DEFAULT_AVG_SPEED_KMH;
  const mPerMin = (speed * 1000) / 60;
  const sorted = [...stops].sort((a, b) => a.order - b.order);

  let path: [number, number][] = polyline;
  if (path.length < 2 && sorted.length >= 2) {
    path = sorted.map((s) => {
      const [lng, lat] = s.location.coordinates;
      return [lng, lat] as [number, number];
    });
  }
  if (path.length < 2) {
    return computeEtasForStops(busLat, busLng, sorted, speed);
  }

  const { distanceFromStartM } = progressAlongPolyline(busLat, busLng, path);
  const out: StopEta[] = [];
  for (const s of sorted) {
    const [slng, slat] = s.location.coordinates;
    const prog = progressAlongPolyline(slat, slng, path);
    const alongStop = prog.distanceFromStartM;
    const passedAlongRoute = distanceFromStartM > alongStop + PASSED_STOP_BUFFER_M;
    if (passedAlongRoute) {
      out.push({
        stopId: String(s._id),
        name: s.name,
        order: s.order,
        distanceMeters: 0,
        etaMinutes: 0,
        relativeToBus: "passed",
      });
      continue;
    }
    const dRoute = Math.max(0, alongStop - distanceFromStartM);
    out.push({
      stopId: String(s._id),
      name: s.name,
      order: s.order,
      distanceMeters: Math.round(dRoute),
      etaMinutes: Math.round((dRoute / mPerMin) * 10) / 10,
      relativeToBus: "approaching",
    });
  }
  return out;
}
