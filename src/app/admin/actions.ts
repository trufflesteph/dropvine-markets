"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { alertsConfig, checkAlertsConfig } from "@/lib/alerts/config";
import { createResendMailer } from "@/lib/alerts/resend-mailer";
import { resolveMarketLocation, sendMarketAlerts } from "@/lib/alerts/send";
import { supabaseAlertStore } from "@/lib/alerts/store-supabase";
import { parseBooths } from "@/lib/booths";
import { cleanImportText } from "@/lib/csv-import";
import { currentRun, formatDateRange, todayInLosAngeles } from "@/lib/market-format";
import {
  isHttpUrl, isValidSlug, type SpotlightLink, type SpotlightPhoto, spotlightImageMaxBytes, spotlightImageTypes,
  spotlightMaxLinks, spotlightMaxPhotos, spotlightSummaryMax,
} from "@/lib/spotlights";
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

function optionalZip(value: FormValue) {
  const parsed = text(value);
  if (!parsed) return null;
  if (!/^\d{5}$/.test(parsed)) throw new Error("ZIP code must be 5 digits");
  return parsed;
}

// Stored as text[]; null rather than an empty array when there are no booths.
function boothsPayload(value: unknown) {
  const booths = parseBooths(value);
  return booths.length ? booths : null;
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

// Rows arrive as JSON from the browser, so clean them again here rather than trusting the client.
function importText(value: unknown) { const cleaned = typeof value === "string" ? cleanImportText(value) : ""; return cleaned || null; }
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
  return { slug, business_name: businessName, category: importText(row.category), photo_url: importText(row.photo_url), blurb: directUrl ? null : importText(row.blurb), dropvine_direct_url: directUrl, external_url: directUrl ? null : importText(row.external_url) };
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
      await request("market_vendor_links", jsonBody({ market_id: marketId, vendor_id: vendor.id, map_x: importNumber(row.map_x), map_y: importNumber(row.map_y), booth_label: boothsPayload(importText(row.booth_label)), featured: false }, "POST"));
      linkedVendorIds.add(vendor.id);
    }
  }
  revalidatePath("/admin");
  return { created, existing, skipped };
}

// Emails confirmed subscribers within range about a published market. Only runs on an explicit confirmation
// click; already-emailed subscribers are skipped (see sendMarketAlerts).
export async function sendMarketAlertsAction(formData: FormData) {
  await requireAdmin();
  const marketId = requiredText(formData, "market_id");
  if (formData.get("confirm") !== "yes") throw new Error("Sending alerts needs an explicit confirmation");

  const config = alertsConfig();
  if (!checkAlertsConfig(config) || !config.resendApiKey) throw new Error("RESEND_API_KEY is not configured");

  const markets = await (await request(`markets?id=eq.${encodeURIComponent(marketId)}&select=id,name,slug,city,state,status,zip,latitude,longitude`)).json() as { id: string; name: string; slug: string; city: string; state: string; status: string; zip: string | null; latitude: number | null; longitude: number | null }[];
  const market = markets[0];
  if (!market) throw new Error("Market not found");
  if (market.status !== "published") throw new Error("Publish the market before sending alerts");

  const location = await resolveMarketLocation(supabaseAlertStore, market);
  if (!location) throw new Error("Add a ZIP code or coordinates to this market before sending alerts");

  const [dates, links] = await Promise.all([
    (await request(`market_dates?market_id=eq.${encodeURIComponent(marketId)}&is_canceled=eq.false&select=date&order=date.asc`)).json() as Promise<{ date: string }[]>,
    request(`market_vendor_links?market_id=eq.${encodeURIComponent(marketId)}&select=id&limit=1`, { headers: { Prefer: "count=exact" } }),
  ]);
  const run = currentRun(dates.map((row) => row.date), todayInLosAngeles());
  const summary = await sendMarketAlerts(
    {
      id: market.id, name: market.name, slug: market.slug, city: market.city, state: market.state,
      dates: run ? formatDateRange(run.start, run.end) : null,
      vendorCount: Number(links.headers.get("content-range")?.split("/")[1] ?? 0),
    },
    location,
    { store: supabaseAlertStore, mailer: createResendMailer(config.resendApiKey, config.fromEmail), config },
  );

  revalidatePath("/admin");
  redirect(`/admin?market=${encodeURIComponent(marketId)}&alerts=${summary.sent}.${summary.failed}.${summary.skipped}`);
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
    zip: optionalZip(formData.get("zip")),
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
    // Kept for Dropvine Direct vendors too: the market vendor list shows it.
    photo_url: text(formData.get("photo_url")),
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

// Spotlights. Text fields save through saveSpotlight (returns an error message instead of throwing, so the form
// keeps what was typed); images, status changes and deletes are plain form actions that redirect back.

export type SpotlightFormState = { error: string | null };
type SpotlightRow = { id: string; slug: string; status: string; permission_confirmed: boolean; hero_image_url: string | null; hero_image_alt: string | null; photos: SpotlightPhoto[]; published_at: string | null };

function revalidateSpotlights(...slugs: string[]) {
  revalidatePath("/admin/spotlights", "layout");
  revalidatePath("/spotlights");
  for (const slug of slugs) revalidatePath(`/spotlights/${slug}`);
  // The header link, the homepage section and market pages all depend on what is published.
  revalidatePath("/", "layout");
}

async function getSpotlightRow(id: string) {
  const rows = await (await request(`spotlights?id=eq.${encodeURIComponent(id)}&select=id,slug,status,permission_confirmed,hero_image_url,hero_image_alt,photos,published_at`)).json() as SpotlightRow[];
  if (!rows[0]) throw new Error("Spotlight not found");
  return rows[0];
}

function spotlightAdminPath(id: string, error?: string) {
  return `/admin/spotlights/${encodeURIComponent(id)}${error ? `?error=${error}` : ""}`;
}

function spotlightPayload(formData: FormData): { error: string } | { payload: Record<string, unknown> } {
  const title = text(formData.get("title"));
  const slug = text(formData.get("slug"))?.toLowerCase() ?? "";
  const makerName = text(formData.get("maker_name"));
  const summary = text(formData.get("summary")) ?? "";
  const category = text(formData.get("maker_category"));
  const videoUrl = text(formData.get("video_url"));
  const sortOrder = Number(text(formData.get("sort_order")) ?? 0);

  if (!title) return { error: "Add a title." };
  if (!isValidSlug(slug)) return { error: "The slug can only use lowercase letters, numbers and single hyphens (80 characters at most)." };
  if (!makerName) return { error: "Add the maker’s name." };
  if (summary.length > spotlightSummaryMax) return { error: `The summary is ${summary.length} characters; keep it to ${spotlightSummaryMax}.` };
  if (category && !vendorCategories.includes(category as (typeof vendorCategories)[number])) return { error: "Choose a category from the list." };
  if (videoUrl && !isHttpUrl(videoUrl)) return { error: "The video URL must start with http:// or https://." };
  if (!Number.isInteger(sortOrder)) return { error: "Sort order must be a whole number." };

  const links: SpotlightLink[] = [];
  for (let index = 0; index < spotlightMaxLinks; index += 1) {
    const label = text(formData.get(`link_label_${index}`));
    const url = text(formData.get(`link_url_${index}`));
    if (!label && !url) continue;
    if (!label || !url) return { error: `Link ${index + 1} needs both a label and a URL.` };
    if (!isHttpUrl(url)) return { error: `Link ${index + 1} must start with http:// or https://.` };
    links.push({ label, url });
  }

  return {
    payload: {
      title, slug, summary, maker_name: makerName, maker_category: category,
      body: typeof formData.get("body") === "string" ? (formData.get("body") as string).replace(/\r\n?/g, "\n").trim() : "",
      vendor_id: text(formData.get("vendor_id")),
      video_url: videoUrl,
      links,
      permission_confirmed: checked(formData, "permission_confirmed"),
      sort_order: sortOrder,
    },
  };
}

export async function saveSpotlight(_previous: SpotlightFormState, formData: FormData): Promise<SpotlightFormState> {
  await requireAdmin();
  const id = text(formData.get("id"));
  const result = spotlightPayload(formData);
  if ("error" in result) return { error: result.error };
  const { payload } = result;

  const clash = await (await request(`spotlights?slug=eq.${encodeURIComponent(payload.slug as string)}${id ? `&id=neq.${encodeURIComponent(id)}` : ""}&select=id&limit=1`)).json() as { id: string }[];
  if (clash.length) return { error: `Another spotlight already uses the slug “${payload.slug}”. Choose a different one.` };

  let savedId = id;
  let previousSlug: string | null = null;
  if (id) {
    const existing = await getSpotlightRow(id);
    previousSlug = existing.slug;
    if (existing.status === "published" && !payload.permission_confirmed) return { error: "This spotlight is published, so the permission box must stay checked. Unpublish it first." };
    await request(`spotlights?id=eq.${encodeURIComponent(id)}`, jsonBody(payload, "PATCH"));
  } else {
    const response = await request("spotlights", jsonBody({ ...payload, status: "draft" }, "POST", true));
    savedId = ((await response.json()) as { id: string }[])[0]?.id ?? null;
    if (!savedId) return { error: "The spotlight could not be created." };
  }

  revalidateSpotlights(payload.slug as string, ...(previousSlug ? [previousSlug] : []));
  redirect(`${spotlightAdminPath(savedId!)}${id ? "?saved=1" : "?created=1"}`);
}

export async function setSpotlightStatus(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  const publish = formData.get("status") === "published";
  const returnTo = formData.get("return_to") === "list" ? "/admin/spotlights" : spotlightAdminPath(id);
  const spotlight = await getSpotlightRow(id);
  const separator = returnTo.includes("?") ? "&" : "?";
  if (publish && !spotlight.permission_confirmed) redirect(`${returnTo}${separator}error=permission`);
  if (publish && spotlight.hero_image_url && !spotlight.hero_image_alt?.trim()) redirect(`${returnTo}${separator}error=alt`);

  await request(`spotlights?id=eq.${encodeURIComponent(id)}`, jsonBody(publish
    ? { status: "published", published_at: spotlight.published_at ?? new Date().toISOString() }
    : { status: "draft" }, "PATCH"));
  revalidateSpotlights(spotlight.slug);
  redirect(returnTo);
}

export async function deleteSpotlight(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  if (formData.get("confirm") !== "yes") throw new Error("Deleting a spotlight needs an explicit confirmation");
  const spotlight = await getSpotlightRow(id);
  await request(`spotlights?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  for (const url of [spotlight.hero_image_url, ...spotlight.photos.map((photo) => photo.url)]) {
    const path = url ? storagePathFromUrl(url) : null;
    if (path) await storageRequest(path, { method: "DELETE" });
  }
  revalidateSpotlights(spotlight.slug);
  redirect("/admin/spotlights");
}

function spotlightImageError(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return "image-missing";
  if (!(spotlightImageTypes as readonly string[]).includes(file.type)) return "image-type";
  if (file.size > spotlightImageMaxBytes) return "image-size";
  return null;
}

export async function uploadSpotlightImage(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  const slot = formData.get("slot") === "hero" ? "hero" : "photo";
  const alt = text(formData.get("alt"));
  const file = formData.get("image");
  const spotlight = await getSpotlightRow(id);

  if (!alt) redirect(spotlightAdminPath(id, "alt"));
  const fileError = spotlightImageError(file);
  if (fileError) redirect(spotlightAdminPath(id, fileError));
  if (slot === "photo" && spotlight.photos.length >= spotlightMaxPhotos) redirect(spotlightAdminPath(id, "photo-limit"));

  const image = file as File;
  const extension = image.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `spotlights/${id}/${crypto.randomUUID()}.${extension}`;
  const upload = await storageRequest(path, { method: "POST", headers: { "Content-Type": image.type, "x-upsert": "false" }, body: await image.arrayBuffer() });
  if (!upload.ok) throw new Error(await upload.text());
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${marketPhotosBucket}/${path}`;

  if (slot === "hero") {
    await request(`spotlights?id=eq.${encodeURIComponent(id)}`, jsonBody({ hero_image_url: url, hero_image_alt: alt }, "PATCH"));
    const oldPath = spotlight.hero_image_url ? storagePathFromUrl(spotlight.hero_image_url) : null;
    if (oldPath) await storageRequest(oldPath, { method: "DELETE" });
  } else {
    const photos: SpotlightPhoto[] = [...spotlight.photos, { url, alt, caption: text(formData.get("caption")) }];
    await request(`spotlights?id=eq.${encodeURIComponent(id)}`, jsonBody({ photos }, "PATCH"));
  }

  revalidateSpotlights(spotlight.slug);
  redirect(spotlightAdminPath(id));
}

// Saves alt text and caption for the hero (index "hero") or one photo, or removes it when remove=yes.
export async function updateSpotlightImage(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  const target = requiredText(formData, "target");
  const remove = formData.get("remove") === "yes";
  const moveBy = Number(formData.get("move") ?? 0);
  const alt = text(formData.get("alt"));
  const spotlight = await getSpotlightRow(id);
  if (!remove && !moveBy && !alt) redirect(spotlightAdminPath(id, "alt"));

  let removedUrl: string | null = null;
  if (target === "hero") {
    // A published spotlight can lose its hero image; the page then shows without one.
    removedUrl = remove ? spotlight.hero_image_url : null;
    await request(`spotlights?id=eq.${encodeURIComponent(id)}`, jsonBody(remove ? { hero_image_url: null, hero_image_alt: null } : { hero_image_alt: alt }, "PATCH"));
  } else {
    const index = Number(target);
    const photo = spotlight.photos[index];
    if (!Number.isInteger(index) || !photo) throw new Error("Photo not found");
    const photos = [...spotlight.photos];
    if (remove) {
      removedUrl = photo.url;
      photos.splice(index, 1);
    } else if (moveBy) {
      const to = index + moveBy;
      if (to < 0 || to >= photos.length) redirect(spotlightAdminPath(id));
      [photos[index], photos[to]] = [photos[to], photos[index]];
    } else {
      photos[index] = { ...photo, alt: alt!, caption: text(formData.get("caption")) };
    }
    await request(`spotlights?id=eq.${encodeURIComponent(id)}`, jsonBody({ photos }, "PATCH"));
  }

  const path = removedUrl ? storagePathFromUrl(removedUrl) : null;
  if (path) await storageRequest(path, { method: "DELETE" });
  revalidateSpotlights(spotlight.slug);
  redirect(spotlightAdminPath(id));
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
    booth_label: boothsPayload(formData.get("booth_label")),
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
