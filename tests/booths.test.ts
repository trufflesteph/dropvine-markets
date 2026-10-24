import assert from "node:assert/strict";
import { test } from "node:test";

import { compareByBooths, formatBooths, parseBooths, sharedBooths, sortBooths } from "../src/lib/booths.ts";

test("input is split on commas, trimmed, and cleared of blanks and repeats", () => {
  assert.deepEqual(parseBooths("12"), ["12"]);
  assert.deepEqual(parseBooths("12, 14"), ["12", "14"]);
  assert.deepEqual(parseBooths(" 12 ,14,, "), ["12", "14"]);
  assert.deepEqual(parseBooths("A12, a12"), ["A12"]);
  assert.deepEqual(parseBooths(""), []);
  assert.deepEqual(parseBooths(null), []);
});

test("stored arrays and pre-migration strings read the same", () => {
  assert.deepEqual(parseBooths(["Table 4", " Near entrance "]), ["Table 4", "Near entrance"]);
  assert.equal(formatBooths("12"), "Booth 12");
  assert.equal(formatBooths(["12"]), "Booth 12");
});

test("short codes get a Booth or Booths prefix", () => {
  assert.equal(formatBooths("12"), "Booth 12");
  assert.equal(formatBooths("12, 14"), "Booths 12, 14");
  assert.equal(formatBooths(["14", "12"]), "Booths 12, 14");
  assert.equal(formatBooths("A12"), "Booth A12");
  assert.equal(formatBooths("B-4, 12A"), "Booths 12A, B-4");
});

test("free-text labels show as written, with no prefix", () => {
  assert.equal(formatBooths("Near entrance"), "Near entrance");
  assert.equal(formatBooths("12, Near entrance"), "12, Near entrance");
  assert.equal(formatBooths("Table 4"), "Table 4");
  assert.equal(formatBooths("Corner"), "Corner");
});

test("nothing shows when there are no booths", () => {
  assert.equal(formatBooths(""), "");
  assert.equal(formatBooths([]), "");
  assert.equal(formatBooths(null), "");
});

test("numeric booths sort as numbers, before labelled ones", () => {
  assert.deepEqual(sortBooths("12, 2"), ["2", "12"]);
  assert.deepEqual(sortBooths("B2, 12, A12, 2, a3"), ["2", "12", "a3", "A12", "B2"]);
  const links = [["12"], null, ["2"], ["A1"]];
  assert.deepEqual(links.sort(compareByBooths), [["2"], ["12"], ["A1"], null]);
});

test("booths held by two vendors are reported", () => {
  const conflicts = sharedBooths([
    { booth_label: ["12", "14"], name: "Happy Knits" },
    { booth_label: "12", name: "Café Sweets" },
    { booth_label: null, name: "No Booth" },
  ]);
  assert.deepEqual(conflicts, [{ booth: "12", names: ["Happy Knits", "Café Sweets"] }]);
});
