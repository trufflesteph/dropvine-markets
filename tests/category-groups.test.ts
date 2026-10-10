import assert from "node:assert/strict";
import { test } from "node:test";

import { categoryGroupSlug, categoryGroups, categoryGroupsFor, categoryPinColors, contrastRatio, filterByCategoryGroups, parseCategoryParam } from "../src/lib/category-groups.ts";
import { vendorCategories } from "../src/lib/vendor-categories.ts";

test("every known category maps to its group", () => {
  const expected: Record<string, string> = {
    "Baked Goods": "food-treats", "Hot Sauce/Condiments": "food-treats", "Jam/Preserves": "food-treats", "Food & Drink": "food-treats",
    "Bath & Beauty": "bath-body-candles", Candles: "bath-body-candles",
    "Fiber Arts": "fiber-fashion", "Fashion/Textiles": "fiber-fashion",
    Art: "art-paper", "Paper Products/Stationery": "art-paper",
    Jewelry: "jewelry",
    Woodworking: "wood-leather", "Leather Goods": "wood-leather",
    "Ceramics/Pottery": "ceramics-pottery",
    "Pet Products": "everything-else", "Classes & Coaching": "everything-else", Other: "everything-else",
  };
  assert.deepEqual(Object.keys(expected).sort(), [...vendorCategories].sort(), "test covers every allowed category");
  for (const [category, slug] of Object.entries(expected)) assert.equal(categoryGroupSlug(category), slug, category);
});

test("matching ignores case and extra whitespace", () => {
  assert.equal(categoryGroupSlug("  fiber arts "), "fiber-fashion");
  assert.equal(categoryGroupSlug("JEWELRY"), "jewelry");
  assert.equal(categoryGroupSlug("Bath   &\tBeauty"), "bath-body-candles");
  assert.equal(categoryGroupSlug("ceramics/pottery\n"), "ceramics-pottery");
});

test("unknown, empty, and missing categories fall to Everything Else", () => {
  for (const value of ["Candles & Soap", "Woodwork", "", "   ", null, undefined]) {
    assert.equal(categoryGroupSlug(value), "everything-else", JSON.stringify(value));
  }
});

test("every allowed category belongs to exactly one group", () => {
  const listed = categoryGroups.flatMap((group) => group.categories as readonly string[]);
  assert.deepEqual([...listed].sort(), [...vendorCategories].sort());
});

test("map pins use the group color, with a readable number color", () => {
  assert.deepEqual(categoryPinColors(" woodworking "), { backgroundColor: "#7A5A3C", color: "#FFFFFF" });
  assert.deepEqual(categoryPinColors("Mystery"), { backgroundColor: "#6B746F", color: "#FFFFFF" });
  assert.deepEqual(categoryPinColors("Jewelry"), { backgroundColor: "#8F6B21", color: "#FFFFFF" });
  for (const group of categoryGroups) {
    const pin = categoryPinColors(group.categories[0]);
    assert.ok(contrastRatio(pin.backgroundColor, pin.color) >= 4.5, `${group.label} number contrast`);
  }
});

test("groups are listed in the band's order with their colors", () => {
  assert.deepEqual(categoryGroups.map((group) => [group.label, group.color]), [
    ["Food & Treats", "#B5502D"], ["Bath, Body & Candles", "#A85D78"], ["Fiber & Fashion", "#6D5A8C"], ["Art & Paper", "#3F6B8F"],
    ["Jewelry", "#8F6B21"], ["Wood & Leather", "#7A5A3C"], ["Ceramics & Pottery", "#3E7C74"], ["Everything Else", "#6B746F"],
  ]);
});

test("a market's groups are distinct and in display order", () => {
  assert.deepEqual(categoryGroupsFor(["Other", "Jewelry", "Art", "jewelry", "Paper Products/Stationery"]), ["art-paper", "jewelry", "everything-else"]);
  assert.deepEqual(categoryGroupsFor([]), []);
});

test("the ?category= param keeps only valid slugs, in display order", () => {
  assert.deepEqual(parseCategoryParam("jewelry,food-treats"), ["food-treats", "jewelry"]);
  assert.deepEqual(parseCategoryParam(" Jewelry , bogus,,jewelry"), ["jewelry"]);
  assert.deepEqual(parseCategoryParam(["art-paper", "wood-leather"]), ["art-paper", "wood-leather"]);
  assert.deepEqual(parseCategoryParam(undefined), []);
});

const markets = [
  { id: "a", category_groups: ["fiber-fashion", "jewelry"] },
  { id: "b", category_groups: ["food-treats"] },
  { id: "c", category_groups: [] },
];
const ids = (list: { id: string }[]) => list.map((market) => market.id);

test("no selection shows every market", () => {
  assert.deepEqual(ids(filterByCategoryGroups(markets, [])), ["a", "b", "c"]);
});

test("multiple selections use OR logic", () => {
  assert.deepEqual(ids(filterByCategoryGroups(markets, ["jewelry"])), ["a"]);
  assert.deepEqual(ids(filterByCategoryGroups(markets, ["jewelry", "food-treats"])), ["a", "b"]);
});

test("a selection with no matching vendors returns nothing", () => {
  assert.deepEqual(ids(filterByCategoryGroups(markets, ["ceramics-pottery"])), []);
});
