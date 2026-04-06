import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "production" ? 30 : 100,
  message: { success: false, error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.NODE_ENV === "production" ? 200 : 1000,
  message: { success: false, error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const locationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  message: { success: false, error: "Too many location updates" },
  standardHeaders: true,
  legacyHeaders: false,
});
