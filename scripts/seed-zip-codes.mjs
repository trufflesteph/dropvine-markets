#!/usr/bin/env node
// One-time (re-runnable) load of US Census ZCTA centroids into public.zip_codes.
//
//   node --env-file=.env.local scripts/seed-zip-codes.mjs            # download the 2026 Gazetteer and upsert
//   node --env-file=.env.local scripts/seed-zip-codes.mjs file.zip   # use a downloaded .zip or extracted .txt
//   node scripts/seed-zip-codes.mjs --dry-run [file]                  # parse and report only; no database access
//
// Source: US Census Bureau Gazetteer ZCTA file (public domain). ZCTAs approximate ZIP codes.
// Idempotent: rows are upserted on zip, so re-running updates coordinates and never duplicates.
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const defaultSource = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip";
const chunkSize = 1000;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const source = args.find((arg) => !arg.startsWith("--")) ?? defaultSource;

async function loadBytes(location) {
  if (/^https?:\/\//.test(location)) {
    console.log(`Downloading ${location}`);
    const response = await fetch(location);
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  }
  return readFile(location);
}

// Extract the first file from a .zip using its local file header (stored or deflate).
function unzipFirstEntry(bytes) {
  if (bytes.readUInt32LE(0) !== 0x04034b50) throw new Error("Not a zip file");
  const flags = bytes.readUInt16LE(6);
  const method = bytes.readUInt16LE(8);
  const compressedSize = bytes.readUInt32LE(18);
  const start = 30 + bytes.readUInt16LE(26) + bytes.readUInt16LE(28);
  if (flags & 0x08 && compressedSize === 0) throw new Error("Zip uses a data descriptor; extract it and pass the .txt instead");
  const data = bytes.subarray(start, start + compressedSize);
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error(`Unsupported zip compression method ${method}`);
}

function parseGazetteer(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  const delimiter = lines[0].includes("|") ? "|" : "\t";
  const headers = lines[0].split(delimiter).map((header) => header.trim().toUpperCase());
  const [zipIndex, latIndex, lngIndex] = ["GEOID", "INTPTLAT", "INTPTLONG"].map((name) => headers.indexOf(name));
  if ([zipIndex, latIndex, lngIndex].includes(-1)) throw new Error(`Unexpected header: ${lines[0]}`);

  const rows = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = line.split(delimiter).map((cell) => cell.trim());
    const zip = cells[zipIndex];
    const latitude = Number(cells[latIndex]);
    const longitude = Number(cells[lngIndex]);
    if (!/^\d{5}$/.test(zip) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      skipped += 1;
      continue;
    }
    rows.push({ zip, latitude, longitude });
  }
  return { rows, skipped };
}

async function upsert(rows) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. node --env-file=.env.local ...)");

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const response = await fetch(`${url}/rest/v1/zip_codes?on_conflict=zip`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
    if (!response.ok) throw new Error(`Upsert failed at row ${index}: ${response.status} ${await response.text()}`);
    process.stdout.write(`\rUpserted ${Math.min(index + chunkSize, rows.length)} / ${rows.length}`);
  }
  process.stdout.write("\n");
}

const bytes = await loadBytes(source);
const text = (bytes.readUInt32LE(0) === 0x04034b50 ? unzipFirstEntry(bytes) : bytes).toString("utf8");
const { rows, skipped } = parseGazetteer(text);
console.log(`Parsed ${rows.length} ZCTAs (${skipped} malformed rows skipped).`);

if (dryRun) {
  console.log("Dry run: sample", rows.slice(0, 2), "…", rows.find((row) => row.zip === "97068"));
} else {
  await upsert(rows);
  console.log("Done.");
}
