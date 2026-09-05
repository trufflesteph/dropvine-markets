"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasAdminSession } from "@/lib/admin-auth";
import { supabaseAdminFetch } from "@/lib/supabase-admin";

const marketTypes = ["farmers", "artisan", "holiday", "night", "popup", "vintage", "other"] as const;

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

function jsonBody(value: unknown, method: string, returnRepresentation = false): RequestInit {
  return {
    method,
    headers: { Prefer: returnRepresentation ? "return=representation" : "return=minimal" },
    body: JSON.stringify(value),
  };
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
    hero_image_url: text(formData.get("hero_image_url")),
    map_image_url: text(formData.get("map_image_url")),
    organizer_name: text(formData.get("organizer_name")),
    organizer_url: text(formData.get("organizer_url")),
    status: formData.get("status") === "published" ? "published" : "draft",
  };
}

export async function createMarket(formData: FormData) {
  await requireAdmin();
  const response = await request("markets", jsonBody(marketPayload(formData), "POST", true));
  const created = await response.json();
  revalidatePath("/admin");
  redirect(`/admin?market=${created[0].id}`);
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
  const directUrl = text(formData.get("dropvine_direct_url"));
  return {
    slug: requiredText(formData, "slug"),
    business_name: requiredText(formData, "business_name"),
    category: requiredText(formData, "category"),
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
  await request(`vendors?id=eq.${encodeURIComponent(id)}`, jsonBody(vendorPayload(formData), "PATCH"));
  revalidatePath("/admin");
  redirect("/admin");
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
