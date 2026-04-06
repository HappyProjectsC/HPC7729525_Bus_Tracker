import { env } from "../config/env.js";

const listedOrigins = (): string[] => env.CORS_ORIGIN.split(",").map((s) => s.trim());

/** True for typical private LAN IPs (mobile dev on same Wi‑Fi). */
function isPrivateLanOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (hostname === "localhost" || hostname === "127.0.0.1") return false;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    const parts = hostname.split(".").map(Number);
    if (
      parts.length === 4 &&
      parts[0] === 172 &&
      parts[1] !== undefined &&
      parts[1] >= 16 &&
      parts[1] <= 31
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Express / Socket.IO `origin` callback — allows listed env origins plus LAN in development. */
export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  if (!origin) {
    callback(null, true);
    return;
  }
  if (listedOrigins().includes(origin)) {
    callback(null, true);
    return;
  }
  if (env.NODE_ENV === "development" && isPrivateLanOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error("Not allowed by CORS"));
}
