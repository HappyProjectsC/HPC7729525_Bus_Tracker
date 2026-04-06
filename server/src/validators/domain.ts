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

const adminEmail = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address");

const adminPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const createUserSchema = z
  .object({
    email: adminEmail,
    password: adminPassword,
    confirmPassword: z.string().min(1, "Confirm password"),
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(100, "Name must be at most 100 characters"),
    role: z.enum(["admin", "driver", "student", "parent"]),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const addParentSchema = z
  .object({
    email: adminEmail,
    password: adminPassword,
    confirmPassword: z.string().min(1, "Confirm password"),
    name: z
      .string()
      .trim()
      .min(1, "Parent name is required")
      .max(100, "Name must be at most 100 characters"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const studentFeedbackSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(2000, "Message is too long"),
});

export const driverFaultSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(2000, "Message is too long"),
});

export const adminFeedbackPatchSchema = z.object({
  adminResponse: z.string().trim().min(1, "Response is required").max(4000),
  status: z.enum(["open", "resolved"]).optional(),
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

/** Admin PATCH /users/:id — at least one field required (checked in controller). */
export const adminUpdateUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(100, "Name must be at most 100 characters")
      .optional(),
    email: adminEmail.optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters")
      .optional(),
    isActive: z.boolean().optional(),
    /** Only for users with role `parent`; `null` clears the link. */
    linkedStudentId: z.string().nullable().optional(),
  })
  .strict();

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
