import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { cleanImportText, decodeCsvBytes, parseCsvRecords } from "../src/lib/csv-import.ts";

const columns = ["business_name", "category", "booth_label", "blurb"] as const;
const windowsFile = readFileSync(new URL("./fixtures/vendors-windows-1252.csv", import.meta.url));

test("a Windows-1252 file with CRLF line endings decodes with its en dash intact", () => {
  const { text, encoding } = decodeCsvBytes(windowsFile);
  assert.equal(encoding, "windows-1252");
  assert.ok(!text.includes("\r"));

  const records = parseCsvRecords(text, columns);
  assert.deepEqual(records.map((record) => record.business_name), [
    "Donald Guenther – Wood Bowls",
    "Herb’s Daughter Custom Soaps",
    "Café Sweets",
  ]);
  assert.equal(records[0].category, "Woodworking");
  assert.equal(records[1].blurb, "Soaps, salves… and more");
  assert.equal(records[2].blurb, "");
});

test("UTF-8 is preferred and the byte order mark is stripped", () => {
  const bytes = new TextEncoder().encode("﻿business_name,category\r\nDonald Guenther – Wood Bowls,Woodworking\r\n");
  const { text, encoding } = decodeCsvBytes(bytes);
  assert.equal(encoding, "utf-8");
  assert.equal(parseCsvRecords(text, columns)[0].business_name, "Donald Guenther – Wood Bowls");
});

test("control characters are cleaned from text fields", () => {
  assert.equal(cleanImportText("Donald Guenther \u0096 Wood Bowls"), "Donald Guenther – Wood Bowls");
  assert.equal(cleanImportText("  Line one\r\nline two\u0000\u0007 "), "Line one line two");
  assert.equal(cleanImportText("Bad\u0081byte"), "Badbyte");
});

test("quoted cells keep commas, doubled quotes, and line breaks", () => {
  const records = parseCsvRecords('business_name,blurb\n"Shop, Inc.","Say ""hi""\nthere"\n', columns);
  assert.equal(records[0].business_name, "Shop, Inc.");
  assert.equal(records[0].blurb, 'Say "hi" there');
});
