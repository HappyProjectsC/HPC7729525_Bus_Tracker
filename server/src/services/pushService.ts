import webpush from "web-push";
import { User } from "../models/User.js";
import { Stop } from "../models/Stop.js";
import { env } from "../config/env.js";
import { haversineMeters } from "../utils/geo.js";
import { logger } from "../config/logger.js";

let configured = false;

export function configureWebPush(): void {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }
}

const notifiedStop = new Map<string, Set<string>>();

export function resetTripNotifications(busId: string): void {
  notifiedStop.delete(busId);
}

export async function notifyApproachingStop(
  busId: string,
  busLat: number,
  busLng: number,
  routeId: string | undefined
): Promise<void> {
  if (!configured || !routeId) return;
  const stops = await Stop.find({ route: routeId }).sort({ order: 1 }).lean();
  if (!stops.length) return;
  let set = notifiedStop.get(busId);
  if (!set) {
    set = new Set();
    notifiedStop.set(busId, set);
  }
  for (const s of stops) {
    const [slng, slat] = s.location.coordinates;
    const d = haversineMeters(busLat, busLng, slat, slng);
    if (d <= env.LOCATION_PUSH_RADIUS_M) {
      const key = String(s._id);
      if (set.has(key)) continue;
      set.add(key);
      const students = await User.find({
        role: "student",
        assignedBus: busId,
        pushSubscription: { $exists: true, $ne: null },
      }).lean();
      const studentIds = students.map((st) => st._id);
      const parents =
        studentIds.length > 0
          ? await User.find({
              role: "parent",
              linkedStudent: { $in: studentIds },
              pushSubscription: { $exists: true, $ne: null },
            }).lean()
          : [];
      const boardingByStudent = new Map(
        students.map((st) => [String(st._id), st.boardingStop ? String(st.boardingStop) : null])
      );
      const payload = JSON.stringify({
        title: "Bus approaching",
        body: `Near stop: ${s.name}`,
        tag: `stop-${busId}-${key}`,
      });
      for (const u of students) {
        if (u.boardingStop && String(u.boardingStop) !== key) continue;
        const sub = u.pushSubscription;
        if (!sub?.endpoint) continue;
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            payload
          );
        } catch (e) {
          logger.warn("Web push failed", e);
        }
      }
      for (const p of parents) {
        const sid = String(p.linkedStudent);
        const bs = boardingByStudent.get(sid);
        if (bs && bs !== key) continue;
        const sub = p.pushSubscription;
        if (!sub?.endpoint) continue;
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            payload
          );
        } catch (e) {
          logger.warn("Web push failed", e);
        }
      }
      break;
    }
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  tag: string
): Promise<void> {
  if (!configured) return;
  const u = await User.findById(userId).select("pushSubscription").lean();
  const sub = u?.pushSubscription;
  if (!sub?.endpoint) return;
  const payload = JSON.stringify({ title, body: truncate(body, 200), tag });
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys,
      },
      payload
    );
  } catch (e) {
    logger.warn("Web push failed", e);
  }
}

/** Students on bus + parents linked to those students. */
export async function notifyBusAudiencePush(
  busId: string,
  title: string,
  body: string,
  tagPrefix: string
): Promise<void> {
  if (!configured) return;
  const students = await User.find({
    role: "student",
    assignedBus: busId,
    pushSubscription: { $exists: true, $ne: null },
  })
    .select("_id")
    .lean();
  const studentIds = students.map((s) => s._id);
  const parents = studentIds.length
    ? await User.find({
        role: "parent",
        linkedStudent: { $in: studentIds },
        pushSubscription: { $exists: true, $ne: null },
      })
        .select("_id")
        .lean()
    : [];
  const ids = [...students.map((s) => String(s._id)), ...parents.map((p) => String(p._id))];
  const tag = `${tagPrefix}-${busId}-${Date.now()}`;
  for (const id of ids) {
    await sendPushToUser(id, title, body, tag);
  }
}
