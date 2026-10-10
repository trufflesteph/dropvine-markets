import type { VendorCategory } from "./vendor-categories.ts";

// The single definition of vendor-category groups: display order, names, colors, and which categories belong
// to each. The homepage "Shop by category" chips and the market map pins both read from here.
export const categoryGroups = [
  { slug: "food-treats", label: "Food & Treats", color: "#B5502D", categories: ["Baked Goods", "Hot Sauce/Condiments", "Jam/Preserves", "Food & Drink"] },
  { slug: "bath-body-candles", label: "Bath, Body & Candles", color: "#A85D78", categories: ["Bath & Beauty", "Candles"] },
  { slug: "fiber-fashion", label: "Fiber & Fashion", color: "#6D5A8C", categories: ["Fiber Arts", "Fashion/Textiles"] },
  { slug: "art-paper", label: "Art & Paper", color: "#3F6B8F", categories: ["Art", "Paper Products/Stationery"] },
  // Design value #D2A03A, darkened at the same hue (40°) to reach 3:1 against the light market map behind the pins.
  { slug: "jewelry", label: "Jewelry", color: "#8F6B21", categories: ["Jewelry"] },
  { slug: "wood-leather", label: "Wood & Leather", color: "#7A5A3C", categories: ["Woodworking", "Leather Goods"] },
  { slug: "ceramics-pottery", label: "Ceramics & Pottery", color: "#3E7C74", categories: ["Ceramics/Pottery"] },
  // Catch-all: also receives any category not listed in another group.
  { slug: "everything-else", label: "Everything Else", color: "#6B746F", categories: ["Pet Products", "Classes & Coaching", "Other"] },
] as const satisfies readonly { slug: string; label: string; color: string; categories: readonly VendorCategory[] }[];

export type CategoryGroup = (typeof categoryGroups)[number];
export type CategoryGroupSlug = CategoryGroup["slug"];

const fallbackGroup = categoryGroups[categoryGroups.length - 1];

function normalizeCategory(category: string) {
  return category.trim().replace(/\s+/g, " ").toLowerCase();
}

const groupByCategory = new Map<string, CategoryGroup>(
  categoryGroups.flatMap((group) => group.categories.map((category) => [normalizeCategory(category), group] as const)),
);

// Matching ignores case and extra whitespace; anything unrecognized is "Everything Else".
export function categoryGroupFor(category: string | null | undefined): CategoryGroup {
  return (category && groupByCategory.get(normalizeCategory(category))) || fallbackGroup;
}

export function categoryGroupSlug(category: string | null | undefined): CategoryGroupSlug {
  return categoryGroupFor(category).slug;
}

function relativeLuminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(first: string, second: string) {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

// Pin fill plus a number color that stays readable (4.5:1) on it: white where it passes, otherwise navy.
export function categoryPinColors(category: string | null | undefined) {
  const { color } = categoryGroupFor(category);
  return { backgroundColor: color, color: contrastRatio(color, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#1D3461" };
}

// Distinct group slugs for a market's vendor categories, in display order.
export function categoryGroupsFor(categories: (string | null | undefined)[]): CategoryGroupSlug[] {
  const present = new Set(categories.map(categoryGroupSlug));
  return categoryGroups.map((group) => group.slug).filter((slug) => present.has(slug));
}

const validSlugs = new Set<string>(categoryGroups.map((group) => group.slug));

// "?category=jewelry,art-paper" → valid slugs in display order; unknown or repeated values are dropped.
export function parseCategoryParam(value: string | string[] | null | undefined): CategoryGroupSlug[] {
  const raw = (Array.isArray(value) ? value.join(",") : value ?? "").split(",").map((part) => part.trim().toLowerCase());
  return categoryGroups.map((group) => group.slug).filter((slug) => raw.includes(slug) && validSlugs.has(slug));
}

// OR logic: a market matches when any of its groups is selected. No selection matches everything.
export function filterByCategoryGroups<Market extends { category_groups: readonly string[] }>(markets: Market[], selected: readonly string[]) {
  if (!selected.length) return markets;
  return markets.filter((market) => market.category_groups.some((slug) => selected.includes(slug)));
}
