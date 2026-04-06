import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type AccessPayload } from "../utils/jwt.js";
import { AppError } from "./errorHandler.js";
import { User, type UserRole } from "../models/User.js";

export interface AuthRequest extends Request {
  user?: AccessPayload & { _id: string };
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      throw new AppError(401, "Authentication required");
    }
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select("_id isActive role");
    if (!user || !user.isActive) {
      throw new AppError(401, "Invalid or inactive user");
    }
    req.user = { ...payload, _id: String(user._id) };
    next();
  } catch (e) {
    next(e instanceof AppError ? e : new AppError(401, "Invalid token"));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "Authentication required"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, "Forbidden"));
      return;
    }
    next();
  };
}
