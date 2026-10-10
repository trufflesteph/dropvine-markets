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
