import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken } from "../utils/jwt.js";
import { User } from "../models/User.js";
import { corsOriginCallback } from "../utils/corsOrigin.js";
import { logger } from "../config/logger.js";
import {
  assertDriverOwnsBus,
  validateLocationPlausibility,
  updateBusLocation,
} from "../services/locationService.js";
import { notifyApproachingStop } from "../services/pushService.js";
import { z } from "zod";

const locationSchema = z.object({
  busId: z.string(),
  lat: z.number(),
  lng: z.number(),
  speedKmh: z.number().optional(),
  heading: z.number().optional(),
  recordedAt: z.number().optional(),
});

export function attachSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOriginCallback,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (typeof socket.handshake.headers.authorization === "string" &&
        socket.handshake.headers.authorization.startsWith("Bearer ")
          ? socket.handshake.headers.authorization.slice(7)
          : null);
      if (!token) {
        next(new Error("Unauthorized"));
        return;
      }
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select("role isActive assignedBus");
      if (!user || !user.isActive) {
        next(new Error("Unauthorized"));
        return;
      }
      socket.data.userId = String(user._id);
      socket.data.role = user.role;
      socket.data.assignedBus = user.assignedBus ? String(user.assignedBus) : null;
      next();
    } catch (e) {
      logger.debug("Socket auth failed", e);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    const role = socket.data.role as string;

    socket.on("subscribe:bus", async (raw: unknown, cb?: (err?: string) => void) => {
      try {
        const busId = typeof raw === "object" && raw && "busId" in raw ? String((raw as { busId: string }).busId) : "";
        if (role !== "student" && role !== "admin") {
          cb?.("Forbidden");
          return;
        }
        if (role === "student") {
          const assigned = socket.data.assignedBus as string | null;
          if (!assigned || assigned !== busId) {
            cb?.("Forbidden");
            return;
          }
        }
        socket.join(`bus:${busId}`);
        cb?.();
      } catch {
        cb?.("Error");
      }
    });

    socket.on("subscribe:admin", async (_raw: unknown, cb?: (err?: string) => void) => {
      if (role !== "admin") {
        cb?.("Forbidden");
        return;
      }
      socket.join("admin");
      cb?.();
    });

    socket.on("driver:location", async (raw: unknown, cb?: (err?: { message: string }) => void) => {
      if (role !== "driver") {
        cb?.({ message: "Forbidden" });
        return;
      }
      const parsed = locationSchema.safeParse(raw);
      if (!parsed.success) {
        cb?.({ message: "Invalid payload" });
        return;
      }
      const body = parsed.data;
      try {
        const bus = await assertDriverOwnsBus(userId, body.busId);
        if (!bus.isTracking) {
          cb?.({ message: "Tracking not started" });
          return;
        }
        const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();
        const bad = validateLocationPlausibility(body.busId, body.lat, body.lng, recordedAt);
        if (bad) {
          cb?.({ message: bad });
          return;
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
        io.to(`bus:${body.busId}`).emit("bus:location", payload);
        io.to("admin").emit("bus:location", payload);
        const routeId = bus.route ? String(bus.route) : undefined;
        await notifyApproachingStop(body.busId, body.lat, body.lng, routeId);
        if (typeof cb === "function") cb();
      } catch (e) {
        logger.warn("driver:location error", e);
        if (typeof cb === "function") cb({ message: e instanceof Error ? e.message : "Error" });
      }
    });

    socket.on("disconnect", () => {
      logger.debug(`Socket disconnect ${userId}`);
    });
  });

  return io;
}
