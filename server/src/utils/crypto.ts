import { createHash, randomBytes } from "crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function randomId(): string {
  return randomBytes(24).toString("hex");
}
