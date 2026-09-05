import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "dropvine_admin_session";
const sessionDurationSeconds = 60 * 60 * 12;

function getSecret() {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error("ADMIN_PASSWORD is not configured");
  }

  return password;
}

function passwordsMatch(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

export function isValidAdminPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected && passwordsMatch(input, expected));
}

function signSession(timestamp: string) {
  return createHmac("sha256", getSecret()).update(timestamp).digest("base64url");
}

function createSessionValue() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return `${timestamp}.${signSession(timestamp)}`;
}

function isValidSessionValue(value: string) {
  const [timestamp, signature] = value.split(".");
  const issuedAt = Number(timestamp);

  if (!timestamp || !signature || !Number.isInteger(issuedAt)) {
    return false;
  }

  if (issuedAt + sessionDurationSeconds < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expectedSignature = Buffer.from(signSession(timestamp));
  const providedSignature = Buffer.from(signature);

  return (
    expectedSignature.length === providedSignature.length &&
    timingSafeEqual(expectedSignature, providedSignature)
  );
}

export async function createAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, createSessionValue(), {
    httpOnly: true,
    maxAge: sessionDurationSeconds,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function hasAdminSession() {
  const token = (await cookies()).get(cookieName)?.value;

  if (!token) {
    return false;
  }

  return isValidSessionValue(token);
}
