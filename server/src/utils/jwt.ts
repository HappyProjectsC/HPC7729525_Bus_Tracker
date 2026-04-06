import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { UserRole } from "../models/User.js";
import { env } from "../config/env.js";

export interface AccessPayload {
  sub: string;
  role: UserRole;
  email: string;
}

const accessSignOpts: SignOptions = {
  expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions["expiresIn"],
  issuer: "college-bus-tracker",
};

const refreshSignOpts: SignOptions = {
  expiresIn: env.JWT_REFRESH_EXPIRES as SignOptions["expiresIn"],
  issuer: "college-bus-tracker",
};

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, accessSignOpts);
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: "college-bus-tracker",
  });
  if (typeof decoded === "string" || !decoded.sub || !decoded.role) {
    throw new Error("Invalid token payload");
  }
  return decoded as AccessPayload;
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: "refresh" }, env.JWT_REFRESH_SECRET, refreshSignOpts);
}

export function verifyRefreshToken(token: string): { sub: string } {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: "college-bus-tracker",
  });
  if (typeof decoded === "string" || !decoded.sub) {
    throw new Error("Invalid refresh token");
  }
  return { sub: decoded.sub as string };
}
