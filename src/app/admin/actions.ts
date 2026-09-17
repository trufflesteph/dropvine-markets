"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { vendorCategories } from "@/lib/vendor-categories";

import { hasAdminSession } from "@/lib/admin-auth";
import { supabaseAdminFetch } from "@/lib/supabase-admin";

const marketTypes = ["Farmers", "Artisan-Craft", "Holiday", "Night", "Popup", "Vintage-Flea", "Other"] as const;
const marketPhotosBucket = "market_photos";
const marketPhotoTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);
const marketPhotoMaxBytes = 10 * 1024 * 1024;

type FormValue = FormDataEntryValue | null;

function text(value: FormValue) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(formData: FormData, name: string) {
  const value = text(formData.get(name));
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalNumber(value: FormValue) {
  const parsed = text(value);
  if (!parsed) return null;
  const number = Number(parsed);
  if (!Number.isFinite(number)) throw new Error("Numeric values must be valid numbers");
  return number;
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

async function requireAdmin() {
  if (!(await hasAdminSession())) redirect("/admin");
}

async function request(path: string, init: RequestInit = {}) {
  const response = await supabaseAdminFetch(path, init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response;
}

function storageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${marketPhotosBucket}/${path}`;
}

async function storageRequest(path: string, init: RequestInit = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = storageUrl(path);
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Supabase storage is not configured");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  return fetch(url, { ...init, headers });
}

function marketIdFromForm(formData: FormData) {
  return requiredText(formData, "market_id");
}

export async function uploadMarketPhotos(formData: FormData) {
  await requireAdmin();
  const marketId = marketIdFromForm(formData);
  const photos = formData.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  const existing = await (await request(`market_photos?market_id=eq.${encodeURIComponent(marketId)}&select=sort_order&order=sort_order.desc`)).json() as { sort_order: number }[];
  let sortOrder = existing[0]?.sort_order ?? -1;

  for (const photo of photos) {
    if (!marketPhotoTypes.has(photo.type)) throw new Error("Photos must be JPEG, PNG, GIF, WebP, or AVIF images");
    if (photo.size > marketPhotoMaxBytes) throw new Error("Each photo must be 10 MB or smaller");
    const extension = photo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${marketId}/${crypto.randomUUID()}.${extension}`;
    const upload = await storageRequest(path, { method: "POST", headers: { "Content-Type": photo.type, "x-upsert": "false" }, body: await photo.arrayBuffer() });
    if (!upload.ok) throw new Error(await upload.text());
    sortOrder += 1;
    await request("market_photos", jsonBody({ market_id: marketId, photo_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${marketPhotosBucket}/${path}`, sort_order: sortOrder }, "POST"));
  }

  revalidatePath("/admin");
  revalidatePath(`/markets/${marketId}`);
  redirect(`/admin?market=${encodeURIComponent(marketId)}`);
}

export async function uploadVendorPhoto(formData: FormData) {
  await requireAdmin();
  const vendorId = requiredText(formData, "vendor_id");
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) throw new Error("Choose a photo to upload");
  if (!marketPhotoTypes.has(photo.type)) throw new Error("Photos must be JPEG, PNG, GIF, WebP, or AVIF images");
  if (photo.size > marketPhotoMaxBytes) throw new Error("Each photo must be 10 MB or smaller");

  const rows = await (await request(`vendors?id=eq.${encodeURIComponent(vendorId)}&select=slug,photo_url`)).json() as { slug: string; photo_url: string | null }[];
  const vendor = rows[0];
  if (!vendor) throw new Error("Vendor not found");

  const extension = photo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `vendors/${vendorId}/${crypto.randomUUID()}.${extension}`;
  const upload = await storageRequest(path, { method: "POST", headers: { "Content-Type": photo.type, "x-upsert": "false" }, body: await photo.arrayBuffer() });
  if (!upload.ok) throw new Error(await upload.text());

  const oldPath = vendor.photo_url ? storagePathFromUrl(vendor.photo_url) : null;
  await request(`vendors?id=eq.${encodeURIComponent(vendorId)}`, jsonBody({ photo_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${marketPhotosBucket}/${path}` }, "PATCH"));
  if (oldPath) await storageRequest(oldPath, { method: "DELETE" });

  revalidatePath("/admin");
  revalidatePath(`/admin/vendors/${vendorId}`);
  redirect(`/admin/vendors/${vendorId}`);
}

function storagePathFromUrl(photoUrl: string) {
  const marker = `/storage/v1/object/public/${marketPhotosBucket}/`;
  const index = photoUrl.indexOf(marker);
  return index >= 0 ? photoUrl.slice(index + marker.length) : null;
}

export async function deleteMarketPhoto(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  const marketId = marketIdFromForm(formData);
  const rows = await (await request(`market_photos?id=eq.${encodeURIComponent(id)}&select=photo_url`)).json() as { photo_url: string }[];
  const path = rows[0] ? storagePathFromUrl(rows[0].photo_url) : null;
  if (path) await storageRequest(path, { method: "DELETE" });
  await request(`market_photos?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  revalidatePath("/admin");
  revalidatePath(`/markets/${marketId}`);
  redirect(`/admin?market=${encodeURIComponent(marketId)}`);
}

export async function reorderMarketPhotos(formData: FormData) {
  await requireAdmin();
  const marketId = marketIdFromForm(formData);
  const ids = JSON.parse(requiredText(formData, "photo_ids")) as string[];
  for (const [sortOrder, id] of ids.entries()) {
    await request(`market_photos?id=eq.${encodeURIComponent(id)}&market_id=eq.${encodeURIComponent(marketId)}`, jsonBody({ sort_order: sortOrder }, "PATCH"));
  }
  revalidatePath("/admin");
  revalidatePath(`/markets/${marketId}`);
  redirect(`/admin?market=${encodeURIComponent(marketId)}`);
}

function jsonBody(value: unknown, method: string, returnRepresentation = false): RequestInit {
  return {
    method,
    headers: { Prefer: returnRepresentation ? "return=representation" : "return=minimal" },
    body: JSON.stringify(value),
  };
}

type ImportRow = {
  business_name?: unknown; category?: unknown; booth_label?: unknown; map_x?: unknown; map_y?: unknown;
  dropvine_direct_url?: unknown; photo_url?: unknown; blurb?: unknown; external_url?: unknown;
};

function importText(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function importNumber(value: unknown) {
  const parsed = importText(value);
  if (!parsed) return null;
  const number = Number(parsed);
  return Number.isFinite(number) ? number : null;
}
function validUrl(value: string | null) {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
}
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "vendor"; }
function importRowError(row: ImportRow) {
  const businessName = importText(row.business_name);
  const category = importText(row.category);
  const mapX = importNumber(row.map_x); const mapY = importNumber(row.map_y);
  const rawMapX = importText(row.map_x); const rawMapY = importText(row.map_y);
  const urls = [row.dropvine_direct_url, row.photo_url, row.external_url].map(importText);
  const errors: string[] = [];
  if (!businessName) errors.push("Missing business name");
  if (!category) errors.push("Missing category");
  if (category && !vendorCategories.includes(category as (typeof vendorCategories)[number])) errors.push("Invalid category");
  if (rawMapX && (mapX === null || mapX < 0 || mapX > 100)) errors.push("Map X must be 0-100");
  if (rawMapY && (mapY === null || mapY < 0 || mapY > 100)) errors.push("Map Y must be 0-100");
  if (urls.some((url) => !validUrl(url))) errors.push("Malformed URL");
  return errors;
}
function importVendorPayload(row: ImportRow, businessName: string, slug: string) {
  const directUrl = importText(row.dropvine_direct_url);
  return { slug, business_name: businessName, category: importText(row.category), photo_url: directUrl ? null : importText(row.photo_url), blurb: directUrl ? null : importText(row.blurb), dropvine_direct_url: directUrl, external_url: directUrl ? null : importText(row.external_url) };
}
function importExistingVendorPayload(row: ImportRow) {
  const payload: Record<string, string> = {};
  for (const field of ["category", "blurb", "photo_url", "external_url", "dropvine_direct_url"] as const) {
    const value = importText(row[field]);
    if (value) payload[field] = value;
  }
  return payload;
}

export type CsvImportResult = { created: number; existing: number; skipped: number };
type ImportedVendor = { id: string; business_name: string; slug: string };

export async function importVendorsFromCsv(_previous: CsvImportResult | null, formData: FormData): Promise<CsvImportResult> {
  await requireAdmin();
  const marketId = requiredText(formData, "market_id");
  const rawRows = requiredText(formData, "rows");
  let rows: ImportRow[];
  try { rows = JSON.parse(rawRows) as ImportRow[]; } catch { throw new Error("CSV rows could not be read"); }
  const existingVendors = await (await request("vendors?select=id,business_name,slug")).json() as ImportedVendor[];
  const vendorsByName = new Map(existingVendors.map((vendor) => [vendor.business_name.trim().toLowerCase(), vendor]));
  const slugs = new Set(existingVendors.map((vendor) => vendor.slug));
  const linkedRows = await (await request(`market_vendor_links?market_id=eq.${encodeURIComponent(marketId)}&select=vendor_id`)).json() as { vendor_id: string }[];
  const linkedVendorIds = new Set(linkedRows.map((link) => link.vendor_id));
  let created = 0; let existing = 0; let skipped = 0;
  for (const row of rows) {
    if (importRowError(row).length) { skipped += 1; continue; }
    const businessName = importText(row.business_name)!;
    const existingVendor = vendorsByName.get(businessName.toLowerCase());
    let vendor: ImportedVendor | undefined = existingVendor;
    if (vendor) {
      existing += 1;
      await request(`vendors?id=eq.${encodeURIComponent(vendor.id)}`, jsonBody(importExistingVendorPayload(row), "PATCH"));
    }
    else {
      const baseSlug = slugify(businessName); let slug = baseSlug; let suffix = 2;
      while (slugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
      const response = await request("vendors", jsonBody(importVendorPayload(row, businessName, slug), "POST", true));
      vendor = (await response.json())[0] as ImportedVendor; slugs.add(slug); vendorsByName.set(businessName.toLowerCase(), vendor); created += 1;
    }
    if (!vendor) throw new Error("Vendor could not be created");
    if (!linkedVendorIds.has(vendor.id)) {
      await request("market_vendor_links", jsonBody({ market_id: marketId, vendor_id: vendor.id, map_x: importNumber(row.map_x), map_y: importNumber(row.map_y), booth_label: importText(row.booth_label), featured: false }, "POST"));
      linkedVendorIds.add(vendor.id);
    }
  }
  revalidatePath("/admin");
  return { created, existing, skipped };
}

function marketPayload(formData: FormData) {
  const marketType = requiredText(formData, "market_type");
  if (!marketTypes.includes(marketType as (typeof marketTypes)[number])) {
    throw new Error("Invalid market type");
  }

  return {
    slug: requiredText(formData, "slug"),
    name: requiredText(formData, "name"),
    market_type: marketType,
    description: text(formData.get("description")),
    city: requiredText(formData, "city"),
    state: requiredText(formData, "state"),
    address: text(formData.get("address")),
    latitude: optionalNumber(formData.get("latitude")),
    longitude: optionalNumber(formData.get("longitude")),
    map_image_url: text(formData.get("map_image_url")),
    organizer_name: text(formData.get("organizer_name")),
    organizer_url: text(formData.get("organizer_url")),
    status: formData.get("status") === "published" ? "published" : "draft",
  };
}

export async function createMarket(formData: FormData) {
  await requireAdmin();
  const response = await request("markets", jsonBody(marketPayload(formData), "POST", true));
  await response.json();
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateMarket(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  await request(`markets?id=eq.${encodeURIComponent(id)}`, jsonBody(marketPayload(formData), "PATCH"));
  revalidatePath("/admin");
  redirect(`/admin?market=${encodeURIComponent(id)}`);
}

export async function deleteMarket(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  await request(`markets?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  revalidatePath("/admin");
  redirect("/admin");
}

function datePayload(formData: FormData) {
  return {
    market_id: requiredText(formData, "market_id"),
    date: requiredText(formData, "date"),
    start_time: text(formData.get("start_time")),
    end_time: text(formData.get("end_time")),
    is_canceled: checked(formData, "is_canceled"),
    note: text(formData.get("note")),
  };
}

export async function createMarketDate(formData: FormData) {
  await requireAdmin();
  const marketId = requiredText(formData, "market_id");
  await request("market_dates", jsonBody(datePayload(formData), "POST"));
  revalidatePath("/admin");
  redirect(`/admin?market=${encodeURIComponent(marketId)}`);
}

export async function updateMarketDate(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  const marketId = requiredText(formData, "market_id");
  await request(`market_dates?id=eq.${encodeURIComponent(id)}`, jsonBody(datePayload(formData), "PATCH"));
  revalidatePath("/admin");
  redirect(`/admin?market=${encodeURIComponent(marketId)}`);
}

export async function deleteMarketDate(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  const marketId = requiredText(formData, "market_id");
  await request(`market_dates?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  revalidatePath("/admin");
  redirect(`/admin?market=${encodeURIComponent(marketId)}`);
}

function vendorPayload(formData: FormData) {
  const useDropvineDirect = formData.get("use_dropvine_direct") === "on";
  const directUrl = useDropvineDirect ? requiredText(formData, "dropvine_direct_url") : null;
  const category = requiredText(formData, "category");
  if (!vendorCategories.includes(category as (typeof vendorCategories)[number])) {
    throw new Error("Invalid vendor category");
  }
  return {
    slug: requiredText(formData, "slug"),
    business_name: requiredText(formData, "business_name"),
    category,
    photo_url: directUrl ? null : text(formData.get("photo_url")),
    blurb: directUrl ? null : text(formData.get("blurb")),
    dropvine_direct_url: directUrl,
    external_url: directUrl ? null : text(formData.get("external_url")),
  };
}

export async function createVendor(formData: FormData) {
  await requireAdmin();
  await request("vendors", jsonBody(vendorPayload(formData), "POST"));
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateVendor(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  const payload = vendorPayload(formData);
  await request(`vendors?id=eq.${encodeURIComponent(id)}`, jsonBody(payload, "PATCH"));
  revalidatePath("/admin");
  redirect(`/admin/vendors/${encodeURIComponent(id)}`);
}

export async function deleteVendor(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  await request(`vendors?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  revalidatePath("/admin");
  redirect("/admin");
}

function linkPayload(formData: FormData) {
  const mapX = optionalNumber(formData.get("map_x"));
  const mapY = optionalNumber(formData.get("map_y"));
  if (mapX !== null && (mapX < 0 || mapX > 100)) throw new Error("Map X must be between 0 and 100");
  if (mapY !== null && (mapY < 0 || mapY > 100)) throw new Error("Map Y must be between 0 and 100");

  return {
    market_id: requiredText(formData, "market_id"),
    vendor_id: requiredText(formData, "vendor_id"),
    map_x: mapX,
    map_y: mapY,
    booth_label: text(formData.get("booth_label")),
    featured: checked(formData, "featured"),
  };
}

export async function createMarketVendorLink(formData: FormData) {
  await requireAdmin();
  const marketId = requiredText(formData, "market_id");
  await request("market_vendor_links", jsonBody(linkPayload(formData), "POST"));
  revalidatePath("/admin");
  redirect(`/admin?market=${encodeURIComponent(marketId)}`);
}

export async function updateMarketVendorLink(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  const marketId = requiredText(formData, "market_id");
  await request(`market_vendor_links?id=eq.${encodeURIComponent(id)}`, jsonBody(linkPayload(formData), "PATCH"));
  revalidatePath("/admin");
  redirect(`/admin?market=${encodeURIComponent(marketId)}`);
}

export async function deleteMarketVendorLink(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  const marketId = requiredText(formData, "market_id");
  await request(`market_vendor_links?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  revalidatePath("/admin");
  redirect(`/admin?market=${encodeURIComponent(marketId)}`);
}
