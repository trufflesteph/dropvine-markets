import assert from "node:assert/strict";
import { test } from "node:test";

import { categoryGroups, contrastRatio } from "../src/lib/category-groups.ts";
import { vendorInitial, vendorThumbnail } from "../src/lib/vendor-thumbnail.ts";

const photo = "https://example.supabase.co/storage/v1/object/public/market_photos/vendors/v1/a.jpg";
const vendor = (overrides: Partial<{ business_name: string; category: string | null; photo_url: string | null }> = {}) =>
  ({ business_name: "Happy Knits", category: "Fiber Arts", photo_url: null, ...overrides });

test("the initial is the first letter or digit, uppercased", () => {
  assert.equal(vendorInitial("happy knits"), "H");
  assert.equal(vendorInitial("  “Quoted” Candles"), "Q");
  assert.equal(vendorInitial("🌿 Herb Garden"), "H");
  assert.equal(vendorInitial("3 Sisters Soap"), "3");
  assert.equal(vendorInitial("éclair bakery"), "É");
});

test("names with no letter or digit fall back to a question mark", () => {
  for (const value of ["", "   ", "★★★", null, undefined]) assert.equal(vendorInitial(value), "?", JSON.stringify(value));
});

test("a vendor with a photo gets the photo", () => {
  assert.deepEqual(vendorThumbnail(vendor({ photo_url: photo })), { kind: "photo", src: photo });
  assert.deepEqual(vendorThumbnail(vendor({ photo_url: `  ${photo} ` })), { kind: "photo", src: photo });
});

test("a missing, blank, or non-http photo URL gets the initial tile", () => {
  for (const photo_url of [null, "", "   ", "not a url", "javascript:alert(1)", "data:image/png;base64,AAAA"]) {
    assert.equal(vendorThumbnail(vendor({ photo_url })).kind, "initial", JSON.stringify(photo_url));
  }
});

test("a photo that failed to load falls back to the initial tile", () => {
  assert.deepEqual(vendorThumbnail(vendor({ photo_url: photo }), true), { kind: "initial", initial: "H", backgroundColor: "#6D5A8C", color: "#FFFFFF" });
});

test("the tile uses the category group color, with unknown categories in Everything Else", () => {
  assert.deepEqual(vendorThumbnail(vendor({ business_name: "Oak & Iron", category: " woodworking " })), { kind: "initial", initial: "O", backgroundColor: "#7A5A3C", color: "#FFFFFF" });
  assert.deepEqual(vendorThumbnail(vendor({ category: "Mystery" })), { kind: "initial", initial: "H", backgroundColor: "#6B746F", color: "#FFFFFF" });
  assert.deepEqual(vendorThumbnail(vendor({ category: null })), { kind: "initial", initial: "H", backgroundColor: "#6B746F", color: "#FFFFFF" });
});

test("every group's initial tile has text contrast of at least 4.5:1", () => {
  for (const group of categoryGroups) {
    const tile = vendorThumbnail(vendor({ category: group.categories[0] }));
    assert.equal(tile.kind, "initial");
    if (tile.kind === "initial") assert.ok(contrastRatio(tile.backgroundColor, tile.color) >= 4.5, `${group.label} initial contrast`);
  }
});
