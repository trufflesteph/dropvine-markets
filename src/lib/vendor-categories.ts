export const vendorCategories = [
  "Baked Goods",
  "Candles",
  "Bath & Beauty",
  "Hot Sauce/Condiments",
  "Jam/Preserves",
  "Fashion/Textiles",
  "Fiber Arts",
  "Art",
  "Ceramics/Pottery",
  "Jewelry",
  "Woodworking",
  "Leather Goods",
  "Paper Products/Stationery",
  "Pet Products",
  "Food & Drink",
  "Classes & Coaching",
  "Other",
] as const;

export type VendorCategory = (typeof vendorCategories)[number];

export const vendorPinGroups = {
  "Food & Treats": ["Baked Goods", "Hot Sauce/Condiments", "Jam/Preserves", "Food & Drink"],
  "Bath, Body & Candles": ["Bath & Beauty", "Candles"],
  "Fiber & Fashion": ["Fiber Arts", "Fashion/Textiles"],
  "Art & Paper": ["Art", "Paper Products/Stationery"],
  Jewelry: ["Jewelry"],
  "Wood & Leather": ["Woodworking", "Leather Goods"],
  "Ceramics/Pottery": ["Ceramics/Pottery"],
  "Everything Else": ["Pet Products", "Classes & Coaching", "Other"],
} as const;

export type VendorPinGroup = keyof typeof vendorPinGroups;

export const vendorPinColors: Record<VendorPinGroup, { background: string; foreground: string }> = {
  "Food & Treats": { background: "#E8875A", foreground: "#321207" },
  "Bath, Body & Candles": { background: "#78B7C9", foreground: "#08222B" },
  "Fiber & Fashion": { background: "#B79AD8", foreground: "#21102F" },
  "Art & Paper": { background: "#F2C14E", foreground: "#241B00" },
  Jewelry: { background: "#D99A9A", foreground: "#321313" },
  "Wood & Leather": { background: "#8FBE5D", foreground: "#122007" },
  "Ceramics/Pottery": { background: "#7BC8A4", foreground: "#092A1A" },
  "Everything Else": { background: "#D5D0C5", foreground: "#211F1A" },
};

const categoryToPinGroup: Record<VendorCategory, VendorPinGroup> = Object.fromEntries(
  Object.entries(vendorPinGroups).flatMap(([group, categories]) => categories.map((category) => [category, group])),
) as Record<VendorCategory, VendorPinGroup>;

export function vendorPinColor(category: string) {
  return vendorPinColors[categoryToPinGroup[category as VendorCategory] ?? "Everything Else"];
}