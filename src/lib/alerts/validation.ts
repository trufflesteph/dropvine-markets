// Shared by the sign-up dialog (client) and the subscribe API route (server), so both agree on what's valid.

export const radiusOptions = [10, 25, 50, 100] as const;
export type RadiusMiles = (typeof radiusOptions)[number];
export const defaultRadius: RadiusMiles = 25;

export type SignupField = "email" | "zip" | "radius";
export type FieldErrors = Partial<Record<SignupField, string>>;
export type SignupValues = { email: string; zip: string; radius_miles: RadiusMiles };

export const errorMessages = {
  email: "Enter a valid email address",
  zip: "Enter a valid 5-digit ZIP",
  unknownZip: "We don't recognize that ZIP code",
  radius: "Choose 10, 25, 50, or 100 miles",
} as const;

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

// Deliberately simple: one @, no spaces, a dot in the domain. The confirmation email is the real check.
export function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email) && !email.includes("..");
}

// Accepts "97068" or ZIP+4 ("97068-1234"); returns the 5-digit ZIP or null.
export function normalizeZip(value: unknown) {
  const match = typeof value === "string" ? value.trim().match(/^(\d{5})(?:-\d{4})?$/) : null;
  return match ? match[1] : null;
}

export function parseRadius(value: unknown): RadiusMiles | null {
  const radius = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return (radiusOptions as readonly number[]).includes(radius) ? (radius as RadiusMiles) : null;
}

export function validateSignup(raw: { email?: unknown; zip?: unknown; radius?: unknown }):
  | { ok: true; value: SignupValues }
  | { ok: false; errors: FieldErrors } {
  const email = normalizeEmail(raw.email);
  const zip = normalizeZip(raw.zip);
  const radius = raw.radius === undefined || raw.radius === "" ? defaultRadius : parseRadius(raw.radius);
  const errors: FieldErrors = {};
  if (!isValidEmail(email)) errors.email = errorMessages.email;
  if (!zip) errors.zip = errorMessages.zip;
  if (!radius) errors.radius = errorMessages.radius;
  if (Object.keys(errors).length || !zip || !radius) return { ok: false, errors };
  return { ok: true, value: { email, zip, radius_miles: radius } };
}
