import { randomBytes } from "node:crypto";

// 256 bits from the OS CSPRNG, base64url-encoded (43 characters). Used for confirm and unsubscribe links.
export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function isWellFormedToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
