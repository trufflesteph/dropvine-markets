import { categoryPinColors } from "./category-groups.ts";

export type VendorThumbnail =
  | { kind: "photo"; src: string }
  | { kind: "initial"; initial: string; backgroundColor: string; color: string };

// First letter or digit of the name, uppercased; skips leading quotes, punctuation, and emoji.
export function vendorInitial(name: string | null | undefined) {
  const match = (name ?? "").match(/[\p{L}\p{N}]/u);
  return match ? match[0].toLocaleUpperCase() : "?";
}

function isHttpPhotoUrl(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// The vendor's photo when it has a usable one that hasn't failed to load; otherwise an initial tile in the
// vendor's category group color, with text that stays readable (4.5:1) on it, same as the map pins.
export function vendorThumbnail(vendor: { business_name: string; category: string | null; photo_url: string | null }, photoFailed = false): VendorThumbnail {
  if (!photoFailed && isHttpPhotoUrl(vendor.photo_url)) return { kind: "photo", src: vendor.photo_url.trim() };
  return { kind: "initial", initial: vendorInitial(vendor.business_name), ...categoryPinColors(vendor.category) };
}
