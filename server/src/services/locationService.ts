import { Bus } from "../models/Bus.js";
import { LocationLog } from "../models/LocationLog.js";
import { impliedSpeedKmh, haversineMeters } from "../utils/geo.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const lastByBus = new Map<string, { lat: number; lng: number; t: number }>();

export interface LocationPayload {
  busId: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
  recordedAt?: number;
}

export async function assertDriverOwnsBus(
  driverId: string,
  busId: string
): Promise<InstanceType<typeof Bus>> {
  const bus = await Bus.findById(busId);
  if (!bus || String(bus.assignedDriver) !== driverId) {
    throw new Error("Bus not assigned to driver");
  }
  return bus;
}

/** Returns null if rejected (spoofing), error message */
export function validateLocationPlausibility(
  busId: string,
  lat: number,
  lng: number,
  recordedAt: Date
): string | null {
  const prev = lastByBus.get(busId);
  if (prev) {
    const dtSec = (recordedAt.getTime() - prev.t) / 1000;
    if (dtSec > 0 && dtSec < 3600) {
      const speed = impliedSpeedKmh(prev.lat, prev.lng, lat, lng, dtSec);
      if (speed > env.MAX_LOCATION_SPEED_KMH) {
        return `Implausible speed ${speed.toFixed(0)} km/h`;
      }
      const jump = haversineMeters(prev.lat, prev.lng, lat, lng);
      if (jump > env.MAX_LOCATION_JUMP_M && dtSec < 5) {
        return "Implausible jump distance";
      }
    }
  }
  lastByBus.set(busId, { lat, lng, t: recordedAt.getTime() });
  return null;
}

export async function updateBusLocation(
  busId: string,
  lat: number,
  lng: number,
  speedKmh?: number,
  heading?: number,
  persistLog = true
): Promise<void> {
  await Bus.findByIdAndUpdate(busId, {
    lastLocation: { type: "Point", coordinates: [lng, lat] },
    lastLocationAt: new Date(),
    speedKmh: speedKmh ?? undefined,
    heading: heading ?? undefined,
  });
  if (persistLog) {
    try {
      await LocationLog.create({
        bus: busId,
        coordinates: [lng, lat],
        recordedAt: new Date(),
        speedKmh,
      });
    } catch (e) {
      logger.warn("LocationLog write failed", e);
    }
  }
}

export function clearBusLast(busId: string): void {
  lastByBus.delete(busId);
}
