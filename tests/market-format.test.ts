import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultShareImage, isImageUrl, marketImageUrl } from "../src/lib/image-url.ts";
import { currentRun, dateFilterWindow, formatDateRange, isInDateFilter, todayInLosAngeles } from "../src/lib/market-format.ts";

test("date ranges use an en dash", () => {
  assert.equal(formatDateRange("2026-11-14", "2026-11-15"), "Nov 14–15");
  assert.equal(formatDateRange("2026-11-30", "2026-12-02"), "Nov 30–Dec 2");
  assert.equal(formatDateRange("2026-11-14", "2026-11-14"), "Nov 14");
});

test("a multi-day market shows its full range on every day, including the last", () => {
  const dates = ["2026-11-14", "2026-11-15", "2026-12-12"];
  for (const today of ["2026-11-01", "2026-11-14", "2026-11-15"]) {
    const run = currentRun(dates, today);
    assert.equal(formatDateRange(run!.start, run!.end), "Nov 14–15", `on ${today}`);
  }
  assert.deepEqual(currentRun(dates, "2026-11-15"), { start: "2026-11-14", end: "2026-11-15", next: "2026-11-15" });
  assert.deepEqual(currentRun(dates, "2026-11-16"), { start: "2026-12-12", end: "2026-12-12", next: "2026-12-12" });
  assert.equal(currentRun(dates, "2026-12-13"), null);
});

test("today is computed in Pacific time", () => {
  // Friday Nov 13, 2026 at 6pm PST is Saturday 02:00 UTC.
  assert.equal(todayInLosAngeles(new Date("2026-11-14T02:00:00Z")), "2026-11-13");
});

test("at 6pm Pacific on a Friday, This weekend includes today, Saturday, and Sunday", () => {
  const today = todayInLosAngeles(new Date("2026-11-14T02:00:00Z"));
  assert.deepEqual(dateFilterWindow("weekend", today), { from: "2026-11-13", to: "2026-11-15" });
  assert.ok(isInDateFilter("2026-11-13", "2026-11-13", "weekend", today), "Friday market");
  assert.ok(isInDateFilter("2026-11-14", "2026-11-15", "weekend", today), "Saturday–Sunday market");
  assert.ok(isInDateFilter("2026-11-15", "2026-11-15", "weekend", today), "Sunday market");
  assert.ok(!isInDateFilter("2026-11-16", "2026-11-16", "weekend", today), "Monday market");
});

test("midweek, This weekend is the coming Saturday and Sunday", () => {
  assert.deepEqual(dateFilterWindow("weekend", "2026-11-11"), { from: "2026-11-14", to: "2026-11-15" });
  assert.ok(isInDateFilter("2026-11-12", "2026-11-14", "weekend", "2026-11-11"), "Thursday–Saturday run overlaps");
  assert.deepEqual(dateFilterWindow("weekend", "2026-11-15"), { from: "2026-11-15", to: "2026-11-15" });
});

test("This month runs from today to the end of the Pacific month", () => {
  const today = todayInLosAngeles(new Date("2026-12-01T05:00:00Z")); // Nov 30, 9pm PST
  assert.deepEqual(dateFilterWindow("month", today), { from: "2026-11-30", to: "2026-11-30" });
  assert.ok(isInDateFilter("2026-11-30", "2026-12-01", "month", today));
  assert.ok(!isInDateFilter("2026-12-01", "2026-12-01", "month", today));
});

test("only real image URLs are used as images", () => {
  assert.ok(isImageUrl("https://example.supabase.co/storage/v1/object/public/market_photos/a/b.jpg"));
  assert.ok(isImageUrl("/brand/west-linn-market.jpg"));
  assert.ok(isImageUrl("https://cdn.example.com/photo.WEBP?width=800"));
  assert.ok(!isImageUrl("https://westlinnoregon.gov/parksrec/adult-community-center-0"));
  assert.ok(!isImageUrl("javascript:alert(1).png"));
  assert.ok(!isImageUrl("photo.jpg"));
  assert.equal(marketImageUrl(undefined, "https://westlinnoregon.gov/parksrec/adult-community-center-0"), null);
  assert.equal(marketImageUrl("https://x.test/first.png", "https://x.test/hero.jpg"), "https://x.test/first.png");
  assert.equal(defaultShareImage.url, "/brand/og-default.png");
});
