import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
});

export const createBusSchema = z.object({
  label: z.string().min(1).max(100),
  plate: z.string().max(50).optional(),
  status: z.enum(["idle", "active", "maintenance"]).optional(),
});

export const createRouteSchema = z.object({
  name: z.string().min(1).max(200),
  polyline: z.array(z.tuple([z.number(), z.number()])).default([]),
  avgSpeedKmh: z.number().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

export const createStopSchema = z.object({
  route: z.string().min(1),
  name: z.string().min(1).max(200),
  order: z.number().int().min(0),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  role: z.enum(["admin", "driver", "student"]),
});

export const assignDriverSchema = z.object({
  driverId: z.string().nullable(),
});

export const assignRouteSchema = z.object({
  routeId: z.string().nullable(),
});

export const assignStudentBusSchema = z.object({
  busId: z.string().nullable(),
});

/** `null` clears boarding stop (alerts apply to all stops). */
export const setBoardingStopSchema = z.object({
  stopId: z.string().min(1).nullable(),
});

export const locationBodySchema = z.object({
  busId: z.string(),
  lat: z.number(),
  lng: z.number(),
  speedKmh: z.number().optional(),
  heading: z.number().optional(),
  recordedAt: z.number().optional(),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});
